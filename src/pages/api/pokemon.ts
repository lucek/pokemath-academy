import type { APIRoute } from 'astro';
import { pokemonListQuerySchema } from '../../lib/validation/pokemon.schema';
import { PokemonService } from '../../lib/services/pokemon.service';
import type { ErrorResponseDto } from '../../types';

export const prerender = false;

/**
 * GET /api/pokemon
 *
 * Public endpoint to retrieve paginated list of Pokemon with optional filtering
 *
 * Query Parameters:
 * - type: (optional) Pokemon type ID for filtering
 * - search: (optional) Full-text search on Pokemon name
 * - limit: (optional) Number of results per page (1-151), default 50
 * - offset: (optional) Pagination offset (>= 0), default 0
 *
 * Returns:
 * - 200: Success with Pokemon list and pagination metadata
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET: APIRoute = async (context) => {
  const startTime = performance.now();

  try {
    // Get Supabase client from context
    const supabase = context.locals.supabase;

    if (!supabase) {
      // eslint-disable-next-line no-console
      console.error('[API /pokemon] Supabase client not found in context');
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection not configured',
          },
        } satisfies ErrorResponseDto),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = {
      type: url.searchParams.get('type'),
      search: url.searchParams.get('search'),
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
    };

    const validationResult = pokemonListQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;

      // eslint-disable-next-line no-console
      console.debug('[API /pokemon] Validation failed:', {
        params: queryParams,
        errors,
      });

      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_QUERY_PARAMS',
            message: 'Invalid query parameters',
            details: errors,
          },
        } satisfies ErrorResponseDto),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Execute service method
    const pokemonService = new PokemonService(supabase);
    const response = await pokemonService.getPokemonList(validationResult.data);

    // Log performance metrics
    const duration = performance.now() - startTime;
    // eslint-disable-next-line no-console
    console.info('[API /pokemon] Request completed:', {
      duration: `${duration.toFixed(2)}ms`,
      resultCount: response.data.length,
      params: validationResult.data,
    });

    // Return success response with cache headers
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    // Log error with context
    const duration = performance.now() - startTime;
    // eslint-disable-next-line no-console
    console.error('[API /pokemon] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration.toFixed(2)}ms`,
    });

    // Return generic error response
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch Pokemon list',
        },
      } satisfies ErrorResponseDto),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
