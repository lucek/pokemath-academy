import type { APIRoute } from 'astro';

import { EncounterSessionStore } from '../../../lib/services/encounter-session.service';
import { EncounterService, EncounterServiceError } from '../../../lib/services/encounter.service';
import { RateLimiter, RateLimiterError } from '../../../lib/services/rate-limit.service';
import { wildEncounterRequestSchema } from '../../../lib/validation/wild-encounter.schema';
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
 * POST /api/encounters/wild
 * Generates a deterministic wild encounter for the authenticated user.
 */
export const POST: APIRoute = async (context) => {
  try {
    const supabase = getSupabaseClient(context, '[POST /api/encounters/wild]');
    const userId = await authenticateUser(supabase, '[POST /api/encounters/wild]');

    const payload = await parseRequestBody(context.request, '[POST /api/encounters/wild]');
    const validationResult = wildEncounterRequestSchema.safeParse(payload);
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
      await rateLimiter.consume(`wild-encounter:${userId}`);
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
      console.error('[POST /api/encounters/wild] Rate limiter failed.', {
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
    const encounter = await encounterService.generateWildEncounter({
      userId,
      seed: validationResult.data.seed,
    });

    const session = buildEncounterSession(encounter, userId, ENCOUNTER_SESSION_TTL_MS);
    EncounterSessionStore.set(session);

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
      // eslint-disable-next-line no-console
      console.error('[POST /api/encounters/wild] Encounter service error.', {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        {
          code: 'internal_server_error',
          message: 'Failed to generate wild encounter. Please try again later.',
        },
        500,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[POST /api/encounters/wild] Unexpected error.', {
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
