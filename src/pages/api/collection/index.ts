import type { APIRoute } from 'astro';
import { collectionQuerySchema } from '../../../lib/validation/collection.schema';
import {
  CollectionService,
  CollectionServiceError,
} from '../../../lib/services/collection.service';
import { RateLimiter, RateLimiterError } from '../../../lib/services/rate-limit.service';
import type { CollectionResponseDto, ErrorResponseDto } from '../../../types';

export const prerender = false;

const rateLimiter = new RateLimiter({ limit: 30, windowMs: 60_000 });

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    // eslint-disable-next-line no-console
    console.warn('[GET /api/collection] Unauthorized access attempt:', {
      error: sessionError?.message,
      hasSession: Boolean(session),
    });

    return jsonError(
      {
        code: 'unauthorized',
        message: 'Authentication required.',
      },
      401,
    );
  }

  const url = new URL(context.request.url);
  const queryParams = {
    caught: url.searchParams.get('caught'),
    type: url.searchParams.get('type'),
    shiny: url.searchParams.get('shiny'),
    sort: url.searchParams.get('sort'),
    order: url.searchParams.get('order'),
    limit: url.searchParams.get('limit'),
    offset: url.searchParams.get('offset'),
  };

  const parsed = collectionQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return jsonError(
      {
        code: 'invalid_query_params',
        message: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    await rateLimiter.consume(`collection-list:${session.user.id}`);
  } catch (error) {
    if (error instanceof RateLimiterError) {
      return jsonError(
        {
          code: 'rate_limit_exceeded',
          message: 'Too many requests. Please slow down.',
        },
        429,
        {
          'Retry-After': String(error.retryAfterSeconds),
        },
      );
    }

    // eslint-disable-next-line no-console
    console.error('[GET /api/collection] Rate limiter failure:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return jsonError(
      {
        code: 'internal_server_error',
        message: 'Failed to enforce rate limit.',
      },
      500,
    );
  }

  try {
    const service = new CollectionService(supabase);
    const { items, total } = await service.listUserCollection({
      userId: session.user.id,
      ...parsed.data,
    });

    const response: CollectionResponseDto = {
      data: items,
      pagination: {
        total,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        hasMore: parsed.data.offset + parsed.data.limit < total,
      },
    };

    return new Response(JSON.stringify(response satisfies CollectionResponseDto), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    if (error instanceof CollectionServiceError) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/collection] Service error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        {
          code: 'internal_server_error',
          message: 'Failed to fetch collection.',
        },
        500,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[GET /api/collection] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return jsonError(
      {
        code: 'internal_server_error',
        message: 'An unexpected error occurred.',
      },
      500,
    );
  }
};

function jsonError(
  body: ErrorResponseDto['error'],
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  const headers =
    extraHeaders == null
      ? { 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json', ...extraHeaders };

  return new Response(JSON.stringify({ error: body } satisfies ErrorResponseDto), {
    status,
    headers,
  });
}
