import type { APIRoute } from 'astro';
import type { TypedSupabaseClient } from '../../../db/supabase.client';
import {
  CollectionService,
  CollectionServiceError,
} from '../../../lib/services/collection.service';
import { EncounterSessionStore } from '../../../lib/services/encounter-session.service';
import { QuestionLruService } from '../../../lib/services/question-lru.service';
import { RateLimiter, RateLimiterError } from '../../../lib/services/rate-limit.service';
import { encounterSubmitRequestSchema } from '../../../lib/validation/encounter-submit.schema';
import { jsonError } from '../../../lib/http/responses';
import { HttpError } from '../../../lib/http/errors';
import { getSupabaseClient, authenticateUser } from '../../../lib/http/auth';
import { parseRequestBody } from '../../../lib/http/requests';
import type {
  AnswerDto,
  EncounterSubmitRequestDto,
  EncounterScoreDto,
  EncounterSession,
  EncounterSubmitResponseDto,
  VariantEnum,
} from '../../../types';

export const prerender = false;

const MIN_CORRECT_TO_CAPTURE = 2;
const submitRateLimiter = new RateLimiter({
  limit: 20,
  windowMs: 60_000,
});

class InvalidSubmissionError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_question' | 'invalid_option',
  ) {
    super(message);
    this.name = 'InvalidSubmissionError';
  }
}

/**
 * POST /api/encounters/submit
 * Evaluates user answers for a pending encounter and records captures on success.
 */
export const POST: APIRoute = async (context) => {
  try {
    const supabase = getSupabaseClient(context, '[POST /api/encounters/submit]');
    const userId = await authenticateUser(supabase, '[POST /api/encounters/submit]');

    await enforceSubmitRateLimit(userId);
    const payload = await parseRequestBody(context.request, '[POST /api/encounters/submit]');
    const { encounterId, answers } = validatePayload(payload);
    const encounterSession = getEncounterSession(encounterId, userId);

    const score = evaluateSubmission(encounterSession, answers);
    QuestionLruService.record(
      userId,
      encounterSession.questions.map((question) => question.id),
    );

    if (score.correct >= MIN_CORRECT_TO_CAPTURE) {
      const response = await handleSuccessfulSubmission({
        supabase,
        session: encounterSession,
        userId,
        encounterId,
        score,
      });

      return jsonResponse(response);
    }

    const response = handleFailedSubmission(encounterSession, encounterId, score);
    return jsonResponse(response);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.body, error.status, error.headers);
    }

    if (error instanceof InvalidSubmissionError) {
      return jsonError(
        {
          code: error.code,
          message: error.message,
        },
        400,
      );
    }

    if (error instanceof CollectionServiceError) {
      // eslint-disable-next-line no-console
      console.error('[POST /api/encounters/submit] Collection service error.', {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        {
          code: 'internal_server_error',
          message: 'Failed to record capture. Please try again later.',
        },
        500,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[POST /api/encounters/submit] Unexpected error.', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return jsonError(
      {
        code: 'internal_server_error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      500,
    );
  }
};

function evaluateSubmission(session: EncounterSession, answers: AnswerDto[]): EncounterScoreDto {
  const questionMap = new Map(session.questions.map((question) => [question.id, question]));
  const answeredQuestions = new Set<string>();

  let correct = 0;
  for (const answer of answers) {
    if (answeredQuestions.has(answer.questionId)) {
      continue;
    }

    answeredQuestions.add(answer.questionId);
    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new InvalidSubmissionError('Unknown question submitted.', 'invalid_question');
    }

    const selectedIndex = answer.selectedOption - 1;
    if (selectedIndex < 0 || selectedIndex >= question.options.length) {
      throw new InvalidSubmissionError(
        'Selected option is out of range for provided question.',
        'invalid_option',
      );
    }

    if (selectedIndex === question.correctIndex) {
      correct += 1;
    }
  }

  return {
    correct,
    total: session.questions.length,
  };
}

async function handleSuccessfulSubmission({
  supabase,
  session,
  userId,
  encounterId,
  score,
}: {
  supabase: TypedSupabaseClient;
  session: EncounterSession;
  userId: string;
  encounterId: string;
  score: EncounterScoreDto;
}): Promise<EncounterSubmitResponseDto> {
  const variant: VariantEnum = session.isShiny ? 'shiny' : 'normal';
  const collectionService = new CollectionService(supabase);
  const captureResult = await collectionService.capturePokemon({
    userId,
    pokemonId: session.pokemonId,
    variant,
  });

  EncounterSessionStore.delete(encounterId);

  if (captureResult.newCapture) {
    return {
      success: true,
      result: 'captured',
      score,
      pokemon: {
        id: session.pokemonId,
        name: session.pokemonName,
        sprite: session.pokemonSprite,
        variant,
        capturedAt: captureResult.capturedAt,
      },
      newCapture: true,
    };
  }

  return {
    success: true,
    result: 'already_captured',
    score,
    pokemon: {
      id: session.pokemonId,
      name: session.pokemonName,
      sprite: session.pokemonSprite,
      variant,
    },
    newCapture: false,
    message: `${session.pokemonName} is already in your collection.`,
  };
}

function handleFailedSubmission(
  session: EncounterSession,
  encounterId: string,
  score: EncounterScoreDto,
): EncounterSubmitResponseDto {
  const attemptsRemaining = Math.max(session.attemptsRemaining - 1, 0);
  const canRetry = attemptsRemaining > 0;

  if (canRetry) {
    const updatedSession: EncounterSession = {
      ...session,
      attemptsRemaining,
    };

    EncounterSessionStore.update(updatedSession);
  } else {
    EncounterSessionStore.delete(encounterId);
  }

  return {
    success: false,
    result: 'failed',
    score,
    attemptsRemaining,
    canRetry,
    message: canRetry
      ? 'Not enough correct answers. You can try again with the remaining attempts.'
      : 'No attempts left. Start a new encounter to keep playing.',
  };
}

async function enforceSubmitRateLimit(userId: string): Promise<void> {
  try {
    await submitRateLimiter.consume(`submit-encounter:${userId}`);
  } catch (error) {
    if (error instanceof RateLimiterError) {
      throw new HttpError(
        429,
        {
          code: 'rate_limit_exceeded',
          message: 'Too many submissions. Please slow down.',
        },
        {
          'Retry-After': String(error.retryAfterSeconds),
        },
      );
    }

    // eslint-disable-next-line no-console
    console.error('[POST /api/encounters/submit] Rate limiter failed.', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new HttpError(500, {
      code: 'internal_server_error',
      message: 'Unable to verify rate limit. Please try again later.',
    });
  }
}

function validatePayload(payload: unknown): EncounterSubmitRequestDto {
  const validationResult = encounterSubmitRequestSchema.safeParse(payload);
  if (!validationResult.success) {
    throw new HttpError(400, {
      code: 'invalid_request_body',
      message: 'Invalid request payload.',
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  return validationResult.data;
}

function getEncounterSession(encounterId: string, userId: string): EncounterSession {
  const encounterSession = EncounterSessionStore.get(encounterId);
  if (!encounterSession) {
    // eslint-disable-next-line no-console
    console.warn('[POST /api/encounters/submit] Encounter session not found or expired.', {
      encounterId,
      userId,
    });

    throw new HttpError(404, {
      code: 'not_found',
      message: 'Encounter session not found. Please start a new encounter.',
    });
  }

  if (encounterSession.userId !== userId) {
    // eslint-disable-next-line no-console
    console.warn('[POST /api/encounters/submit] Encounter session user mismatch.', {
      encounterId,
      sessionUserId: encounterSession.userId,
      requester: userId,
    });

    throw new HttpError(404, {
      code: 'not_found',
      message: 'Encounter session not found. Please start a new encounter.',
    });
  }

  return encounterSession;
}

function jsonResponse(body: EncounterSubmitResponseDto): Response {
  return new Response(JSON.stringify(body satisfies EncounterSubmitResponseDto), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
