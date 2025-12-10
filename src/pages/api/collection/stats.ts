import {
  CollectionService,
  CollectionServiceError,
} from '../../../lib/services/collection.service';
import type { CollectionStatsDto, ErrorResponseDto } from '../../../types';

import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * GET /api/collection/stats
 * Returns aggregated collection statistics for the authenticated user
 *
 * Response 200: CollectionStatsDto
 * Response 401: ErrorResponseDto (Unauthorized - no session)
 * Response 500: ErrorResponseDto (Internal server error)
 */
export const GET: APIRoute = async (context) => {
  try {
    // Get Supabase client from context
    const supabase = context.locals.supabase;

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      // eslint-disable-next-line no-console
      console.warn('[GET /api/collection/stats] Unauthorized access attempt:', {
        error: sessionError?.message,
        hasSession: !!session,
      });

      const errorResponse: ErrorResponseDto = {
        error: {
          code: 'unauthorized',
          message: 'Authentication required. Please sign in to access collection statistics.',
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const userId = session.user.id;

    // Call service to get collection stats
    const collectionService = new CollectionService(supabase);
    const stats: CollectionStatsDto = await collectionService.getUserCollectionStats(userId);

    // Return success response
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Handle service-specific errors
    if (error instanceof CollectionServiceError) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/collection/stats] Service error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      const errorResponse: ErrorResponseDto = {
        error: {
          code: 'internal_server_error',
          message: 'Failed to fetch collection statistics. Please try again later.',
          details: error.details,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Handle unexpected errors
    // eslint-disable-next-line no-console
    console.error('[GET /api/collection/stats] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorResponse: ErrorResponseDto = {
      error: {
        code: 'internal_server_error',
        message: 'An unexpected error occurred. Please try again later.',
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
