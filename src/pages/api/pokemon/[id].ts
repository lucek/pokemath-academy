import type { APIRoute } from 'astro';
import { pokemonDetailParamsSchema } from '../../../lib/validation/pokemon.schema';
import { PokemonService, PokemonServiceError } from '../../../lib/services/pokemon.service';
import type { ErrorResponseDto } from '../../../types';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const startTime = performance.now();
  const supabase = context.locals.supabase;
  const rawParams = { id: context.params?.id };
  let pokemonId: number | null = null;

  if (!supabase) {
    // eslint-disable-next-line no-console
    console.error('[API /pokemon/:id] Supabase client not available in context');
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

  const validationResult = pokemonDetailParamsSchema.safeParse(rawParams);

  if (!validationResult.success) {
    const errors = validationResult.error.flatten().fieldErrors;

    // eslint-disable-next-line no-console
    console.debug('[API /pokemon/:id] Path param validation failed', {
      params: rawParams,
      errors,
    });

    return new Response(
      JSON.stringify({
        error: {
          code: 'INVALID_PATH_PARAM',
          message: 'Invalid Pokemon identifier',
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

  pokemonId = validationResult.data.id;

  const pokemonService = new PokemonService(supabase);
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    // eslint-disable-next-line no-console
    console.debug('[API /pokemon/:id] Failed to resolve user session', {
      id: pokemonId,
      error: authError.message,
    });
  }

  const userId = authData?.user?.id ?? null;

  try {
    const detail = await pokemonService.getPokemonDetail(pokemonId, { userId });

    if (!detail) {
      const duration = performance.now() - startTime;
      // eslint-disable-next-line no-console
      console.info('[API /pokemon/:id] Pokemon not found', {
        id: pokemonId,
        duration: `${duration.toFixed(2)}ms`,
      });

      return new Response(
        JSON.stringify({
          error: {
            code: 'POKEMON_NOT_FOUND',
            message: 'Pokemon not found',
          },
        } satisfies ErrorResponseDto),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const duration = performance.now() - startTime;
    // eslint-disable-next-line no-console
    console.info('[API /pokemon/:id] Request completed', {
      id: pokemonId,
      duration: `${duration.toFixed(2)}ms`,
    });

    return new Response(JSON.stringify(detail), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    const duration = performance.now() - startTime;

    if (error instanceof PokemonServiceError) {
      // eslint-disable-next-line no-console
      console.error('[API /pokemon/:id] Service error', {
        id: pokemonId,
        code: error.code,
        details: error.details,
        duration: `${duration.toFixed(2)}ms`,
      });
    } else {
      // eslint-disable-next-line no-console
      console.error('[API /pokemon/:id] Unexpected error', {
        id: pokemonId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration.toFixed(2)}ms`,
      });
    }

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch Pokemon detail',
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
