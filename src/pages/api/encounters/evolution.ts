import type { APIRoute } from 'astro';
import { EncounterSessionStore } from '../../../lib/services/encounter-session.service';
import { EncounterService, EncounterServiceError } from '../../../lib/services/encounter.service';
import { RateLimiter, RateLimiterError } from '../../../lib/services/rate-limit.service';
import { evolutionEncounterRequestSchema } from '../../../lib/validation/evolution-encounter.schema';
import type { EncounterResponseDto } from '../../../types';
import { buildEncounterSession } from '../../../lib/encounters/session';
import { jsonError } from '../../../lib/http/responses';
import { HttpError } from '../../../lib/http/errors';
import { getSupabaseClient, authenticateUser } from '../../../lib/http/auth';
import { parseRequestBody } from '../../../lib/http/requests';

export const prerender = false;

const rateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
});

const ENCOUNTER_SESSION_TTL_MS = 15 * 60_000;

/**
 * POST /api/encounters/evolution
 * Generates a deterministic evolution encounter for the authenticated user.
 */
export const POST: APIRoute = async (context) => {
  try {
    const supabase = getSupabaseClient(context, '[POST /api/encounters/evolution]');
    const userId = await authenticateUser(supabase, '[POST /api/encounters/evolution]');

    const payload = await parseRequestBody(context.request, '[POST /api/encounters/evolution]');
    const validationResult = evolutionEncounterRequestSchema.safeParse(payload);
    if (!validationResult.success) {
      return jsonError(
        {
          code: 'invalid_request_body',
          message: 'Invalid request payload.',
          details: validationResult.error.flatten().fieldErrors,
        },
        400,
      );
    }

    try {
      await rateLimiter.consume(`evolution-encounter:${userId}`);
    } catch (error) {
      if (error instanceof RateLimiterError) {
        return jsonError(
          {
            code: 'rate_limit_exceeded',
            message: 'Too many encounters started. Please try again later.',
          },
          429,
          {
            'Retry-After': String(error.retryAfterSeconds),
          },
        );
      }

      // eslint-disable-next-line no-console
      console.error('[POST /api/encounters/evolution] Rate limiter failed.', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return jsonError(
        {
          code: 'internal_server_error',
          message: 'Unable to verify rate limit. Please try again later.',
        },
        500,
      );
    }

    const encounterService = new EncounterService(supabase);
    const encounter = await encounterService.generateEvolutionEncounter({
      userId,
      baseId: validationResult.data.baseId,
      evolutionId: validationResult.data.evolutionId,
      seed: validationResult.data.seed,
    });

    const sessionSnapshot = buildEncounterSession(encounter, userId, ENCOUNTER_SESSION_TTL_MS);
    EncounterSessionStore.set(sessionSnapshot);

    return new Response(JSON.stringify(encounter satisfies EncounterResponseDto), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.body, error.status, error.headers);
    }

    if (error instanceof EncounterServiceError) {
      // Map business errors to appropriate HTTP codes
      if (error.code === 'BASE_NOT_CAPTURED') {
        // eslint-disable-next-line no-console
        console.warn('[POST /api/encounters/evolution] Base not captured.', {});
        return jsonError(
          {
            code: 'forbidden',
            message: 'You must own the base Pokémon to start this evolution encounter.',
          },
          403,
        );
      }

      if (error.code === 'EVOLUTION_RELATION_NOT_FOUND') {
        // eslint-disable-next-line no-console
        console.warn('[POST /api/encounters/evolution] Evolution relation not found.', {});
        return jsonError(
          {
            code: 'not_found',
            message: 'Requested evolution path does not exist.',
          },
          404,
        );
      }

      // eslint-disable-next-line no-console
      console.error('[POST /api/encounters/evolution] Encounter service error.', {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        {
          code: 'internal_server_error',
          message: 'Failed to generate evolution encounter. Please try again later.',
        },
        500,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[POST /api/encounters/evolution] Unexpected error.', {
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
