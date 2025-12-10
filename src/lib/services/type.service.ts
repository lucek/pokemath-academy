import type { TypeDto } from '../../types';
import type { TypedSupabaseClient } from '../../db/supabase.client';

/**
 * Error codes emitted by TypeService to allow granular handling in API routes.
 */
export type TypeServiceErrorCode = 'DATABASE_QUERY_FAILED' | 'UNEXPECTED_ERROR';

/**
 * Consistent error wrapper for all failures produced by TypeService.
 */
export class TypeServiceError extends Error {
  constructor(
    message: string,
    public readonly code: TypeServiceErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TypeServiceError';
  }
}

/**
 * Service responsible for retrieving Pokemon types from Supabase.
 */
export class TypeService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Fetches the list of Pokemon types in a deterministic order.
   *
   * @returns Promise with ordered TypeDto collection.
   * @throws TypeServiceError whenever Supabase responds with an error or an unexpected exception occurs.
   */
  async getAllTypes(): Promise<TypeDto[]> {
    try {
      const { data, error } = await this.supabase
        .from('types')
        .select('id, name')
        .order('id', { ascending: true });

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[TypeService] Supabase query failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        throw new TypeServiceError('Failed to fetch Pokemon types', 'DATABASE_QUERY_FAILED', {
          code: error.code,
          hint: error.hint,
        });
      }

      return (data ?? []).map((type) => ({
        id: type.id,
        name: type.name,
      }));
    } catch (error) {
      if (error instanceof TypeServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[TypeService] Unexpected failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TypeServiceError(
        'Unexpected error while fetching Pokemon types',
        'UNEXPECTED_ERROR',
      );
    }
  }
}
