import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { typesListQuerySchema } from '../../lib/validation/types.schema';
import { TypeService, TypeServiceError } from '../../lib/services/type.service';
import type { ErrorResponseDto, TypeListResponseDto } from '../../types';

export const prerender = false;

/**
 * GET /api/types
 *
 * Public endpoint returning the full list of Pokemon types.
 * Does not accept any query parameters and is safe to cache aggressively.
 */
export const GET: APIRoute = async (context) => {
  const startTime = performance.now();

  try {
    const supabase = context.locals.supabase;

    if (!supabase) {
      // eslint-disable-next-line no-console
      console.error('[API /types] Supabase client missing on context');

      return jsonErrorResponse(
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database client not configured',
        },
        500,
      );
    }

    const url = new URL(context.request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = typesListQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      // eslint-disable-next-line no-console
      console.warn('[API /types] Invalid query parameters', {
        params: queryParams,
        errors: fieldErrors,
      });

      return jsonErrorResponse(
        {
          code: 'INVALID_QUERY_PARAMS',
          message: 'This endpoint does not accept query parameters',
          details: fieldErrors,
        },
        400,
      );
    }

    const typeService = new TypeService(supabase);
    const data = await typeService.getAllTypes();
    const body: TypeListResponseDto = { data };
    const payload = JSON.stringify(body);
    const etag = `"${createHash('sha1').update(payload).digest('hex')}"`;

    // Short-circuit if the client already has the latest data.
    if (context.request.headers.get('if-none-match') === etag) {
      const headers = buildSuccessHeaders(etag);
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    const headers = buildSuccessHeaders(etag);

    const durationMs = performance.now() - startTime;
    // eslint-disable-next-line no-console
    console.info('[API /types] Request completed', {
      duration: `${durationMs.toFixed(2)}ms`,
      resultCount: data.length,
    });

    return new Response(payload, {
      status: 200,
      headers,
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;

    if (error instanceof TypeServiceError) {
      // eslint-disable-next-line no-console
      console.error('[API /types] TypeService error', {
        code: error.code,
        details: error.details,
        duration: `${durationMs.toFixed(2)}ms`,
      });

      return jsonErrorResponse(
        {
          code: error.code,
          message: 'Failed to load Pokemon types',
          details: error.details,
        },
        500,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[API /types] Unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${durationMs.toFixed(2)}ms`,
    });

    return jsonErrorResponse(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected error while loading Pokemon types',
      },
      500,
    );
  }
};

/**
 * Utility helper for consistent JSON error responses.
 */
function jsonErrorResponse(error: ErrorResponseDto['error'], status: number): Response {
  return new Response(
    JSON.stringify({
      error,
    } satisfies ErrorResponseDto),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

/**
 * Builds caching headers for successful responses.
 */
function buildSuccessHeaders(etag: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  headers.set('ETag', etag);
  return headers;
}
