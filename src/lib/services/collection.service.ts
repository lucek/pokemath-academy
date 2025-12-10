import type {
  CapturePokemonCommand,
  CollectionItemDto,
  CollectionStatsDto,
  MyCollectionViewEntity,
  PokemonSpritesDto,
  PokemonTypeDto,
  RecentCaptureDto,
  TypeBreakdownDto,
  VariantBreakdownDto,
} from '../../types';

import type { CollectionQueryInput } from '../validation/collection.schema';
import type { TypedSupabaseClient } from '../../db/supabase.client';

export type CollectionServiceErrorCode =
  | 'DATABASE_QUERY_FAILED'
  | 'DATA_TRANSFORMATION_FAILED'
  | 'UNEXPECTED_ERROR';

export class CollectionServiceError extends Error {
  constructor(
    message: string,
    public readonly code: CollectionServiceErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CollectionServiceError';
  }
}

type SortField = 'pokedex' | 'name' | 'date';
type SortOrder = 'asc' | 'desc';

type ListCollectionParams = CollectionQueryInput & {
  userId: string;
};

interface CapturedCollectionParams {
  userId: string;
  type?: number;
  shiny?: boolean;
  sort: SortField;
  order: SortOrder;
  limit: number;
  offset: number;
}

interface UncaughtCollectionParams {
  excludeIds: Set<number>;
  type?: number;
  sort: SortField;
  order: SortOrder;
  limit: number;
  offset: number;
}

interface FullCollectionParams {
  userId: string;
  type?: number;
  sort: SortField;
  order: SortOrder;
}

interface CollectionListResult {
  items: CollectionItemDto[];
  total: number;
}

type MyCollectionViewRow = Pick<
  MyCollectionViewEntity,
  'pokemon_id' | 'pokemon_name' | 'sprites' | 'type_details' | 'variant' | 'captured_at'
>;

interface PokemonCatalogViewRow {
  pokemon_id: number | null;
  pokemon_name: string | null;
  sprites: unknown;
  type_details: unknown;
}

interface CapturedPokemonIdRow {
  pokemon_id: number | null;
}

interface TypeDetailJson {
  type_id: number;
  type_name: string;
  slot: number;
}

interface UserCaptureStatsRow {
  user_id: string | null;
  total_captured: number | null;
  unique_pokemon_count: number | null;
  shiny_count: number | null;
  normal_count: number | null;
  last_capture_at: string | null;
}

interface RecentCaptureRow {
  pokemon_id: number;
  variant: 'normal' | 'shiny';
  captured_at: string | null;
  pokemon: {
    name: string;
    sprites: unknown;
  };
}

interface CapturedPokemonRow {
  captured_at: string | null;
}

/**
 * Service for collection-related operations
 * Handles business logic and database interactions for user Pokemon collections
 */
export class CollectionService {
  constructor(private readonly supabase: TypedSupabaseClient) {}
  private static readonly GEN1_POKEMON_COUNT = 151;

  /**
   * List collection entries for a user with filtering, sorting, and pagination.
   * Delegates to captured or uncaught data sources based on the `caught` flag.
   */
  async listUserCollection(params: ListCollectionParams): Promise<CollectionListResult> {
    const { userId, caught, type, shiny, sort, order, limit, offset } = params;

    try {
      if (caught === false) {
        const capturedIds = await this.fetchCapturedPokemonIds(userId);
        return this.fetchUncaughtFromCatalog({
          excludeIds: capturedIds,
          type,
          sort,
          order,
          limit,
          offset,
        });
      }

      if (caught === true) {
        return this.fetchCapturedFromView({
          userId,
          type,
          shiny,
          sort,
          order,
          limit,
          offset,
        });
      }

      const combined = await this.fetchFullCollection({
        userId,
        type,
        sort,
        order,
      });

      return {
        items: combined.items.slice(offset, offset + limit),
        total: combined.total,
      };
    } catch (error) {
      if (error instanceof CollectionServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[CollectionService] Unexpected error in listUserCollection:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CollectionServiceError(
        'Unexpected error while listing user collection',
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Upsert a captured Pokemon for the provided user and variant.
   * Returns whether the capture was new and the timestamp recorded by the DB.
   */
  async capturePokemon(
    command: CapturePokemonCommand,
  ): Promise<{ newCapture: boolean; capturedAt?: string }> {
    try {
      const existing = await this.getCaptureRecord(command);
      if (existing) {
        return {
          newCapture: false,
          capturedAt: existing.captured_at ?? undefined,
        };
      }

      const { data, error } = await this.supabase
        .from('captured_pokemon')
        .insert({
          user_id: command.userId,
          pokemon_id: command.pokemonId,
          variant: command.variant,
        })
        .select('captured_at')
        .single();

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[CollectionService] Failed to insert captured pokemon:', {
          userId: command.userId,
          pokemonId: command.pokemonId,
          variant: command.variant,
          error: error.message,
          code: error.code,
          hint: error.hint,
        });

        throw new CollectionServiceError('Failed to capture pokemon', 'DATABASE_QUERY_FAILED', {
          code: error.code,
          hint: error.hint,
        });
      }

      return {
        newCapture: true,
        capturedAt: data?.captured_at ?? new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof CollectionServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[CollectionService] Unexpected error in capturePokemon:', {
        userId: command.userId,
        pokemonId: command.pokemonId,
        variant: command.variant,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CollectionServiceError(
        'Unexpected error while capturing pokemon',
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Get aggregated collection statistics for a user
   *
   * @param userId - User identifier from authentication
   * @returns Promise resolving to collection statistics
   * @throws CollectionServiceError if database query fails or data transformation fails
   */
  async getUserCollectionStats(userId: string): Promise<CollectionStatsDto> {
    try {
      // Query 1: Get user capture stats from materialized view
      const statsPromise = this.getUserStats(userId);

      // Query 2: Get type breakdown
      const typeBreakdownPromise = this.getTypeBreakdown(userId);

      // Query 3: Get recent captures (last 5)
      const recentCapturesPromise = this.getRecentCaptures(userId);

      // Execute all queries in parallel
      const [stats, typeBreakdown, recentCaptures] = await Promise.all([
        statsPromise,
        typeBreakdownPromise,
        recentCapturesPromise,
      ]);

      // Calculate completion percentage (out of 151 Gen 1 Pokemon)
      const totalPossible = 151;
      const totalCaptured = stats?.unique_pokemon_count ?? 0;
      const percentage = Math.round((totalCaptured / totalPossible) * 10000) / 100;

      const variantBreakdown: VariantBreakdownDto = {
        normal: stats?.normal_count ?? 0,
        shiny: stats?.shiny_count ?? 0,
      };

      return {
        totalCaptured,
        totalPossible,
        percentage,
        shinyCount: stats?.shiny_count ?? 0,
        variantBreakdown,
        typeBreakdown,
        recentCaptures,
      };
    } catch (error) {
      if (error instanceof CollectionServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[CollectionService] Unexpected error in getUserCollectionStats:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CollectionServiceError(
        'Unexpected error while fetching collection stats',
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Fetch user capture stats from materialized view
   */
  private async getUserStats(userId: string): Promise<UserCaptureStatsRow | null> {
    const { data, error } = await this.supabase
      .from('user_capture_stats')
      .select(
        'user_id, total_captured, unique_pokemon_count, shiny_count, normal_count, last_capture_at',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch user capture stats:', {
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError(
        'Failed to fetch user capture stats',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    return data as UserCaptureStatsRow | null;
  }

  /**
   * Fetch type breakdown for user's captured Pokemon
   * Joins pokemon_types with captured_pokemon filtered by user
   */
  private async getTypeBreakdown(userId: string): Promise<TypeBreakdownDto[]> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select(
        `
        pokemon_id,
        pokemon!inner(
          pokemon_types!inner(
            type_id,
            types!inner(
              id,
              name
            )
          )
        )
      `,
      )
      .eq('user_id', userId);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch type breakdown (manual):', {
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError('Failed to fetch type breakdown', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    // Aggregate types manually
    const typeMap = new Map<number, { typeId: number; typeName: string; count: number }>();

    for (const capture of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pokemon = (capture as any).pokemon;
      if (!pokemon?.pokemon_types) continue;

      for (const pt of pokemon.pokemon_types) {
        if (!pt?.types) continue;
        const typeId = pt.types.id;
        const typeName = pt.types.name;

        const existing = typeMap.get(typeId);
        if (existing) {
          existing.count += 1;
        } else {
          typeMap.set(typeId, { typeId, typeName, count: 1 });
        }
      }
    }

    return Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Fetch recent captures (last 5) for user
   */
  private async getRecentCaptures(userId: string): Promise<RecentCaptureDto[]> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select(
        `
        pokemon_id,
        variant,
        captured_at,
        pokemon!inner(
          name,
          sprites
        )
      `,
      )
      .eq('user_id', userId)
      .order('captured_at', { ascending: false })
      .limit(5);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch recent captures:', {
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError('Failed to fetch recent captures', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    return (data ?? []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const captureRow = row as any;
      return this.mapRecentCapture({
        pokemon_id: captureRow.pokemon_id,
        variant: captureRow.variant,
        captured_at: captureRow.captured_at,
        pokemon: captureRow.pokemon,
      });
    });
  }

  private async fetchCapturedFromView(
    params: CapturedCollectionParams,
  ): Promise<CollectionListResult> {
    const { userId, type, shiny, sort, order, limit, offset } = params;

    let query = this.supabase
      .from('my_collection_vw')
      .select('pokemon_id, pokemon_name, sprites, type_details, variant, captured_at', {
        count: 'exact',
      })
      .eq('user_id', userId);

    if (typeof shiny === 'boolean') {
      query = query.eq('variant', shiny ? 'shiny' : 'normal');
    }

    if (typeof type === 'number') {
      query = query.contains('type_details', [{ type_id: type }]);
    }

    const sortColumn = this.getCapturedSortColumn(sort);
    const { data, error, count } = await query
      .order(sortColumn, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to query my_collection_vw:', {
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError(
        'Failed to fetch captured collection items',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    const rows = (data ?? []) as MyCollectionViewRow[];
    const items = rows.map((row) => this.mapCapturedRow(row));

    return {
      items,
      total: count ?? rows.length,
    };
  }

  private async fetchCapturedPokemonIds(userId: string): Promise<Set<number>> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('pokemon_id')
      .eq('user_id', userId);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch captured IDs:', {
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError(
        'Failed to fetch captured pokemon ids',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    const ids = new Set<number>();
    for (const row of (data ?? []) as CapturedPokemonIdRow[]) {
      if (typeof row.pokemon_id === 'number') {
        ids.add(row.pokemon_id);
      }
    }

    return ids;
  }

  private async fetchPokemonCatalogRows(params: {
    type?: number;
    sort: SortField;
    order: SortOrder;
  }): Promise<PokemonCatalogViewRow[]> {
    let query = this.supabase
      .from('pokemon_catalog_vw')
      .select('pokemon_id, pokemon_name, sprites, type_details')
      .order(this.getCatalogSortColumn(params.sort), { ascending: params.order === 'asc' });

    if (typeof params.type === 'number') {
      query = query.contains('type_details', [{ type_id: params.type }]);
    }

    const { data, error } = await query;

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch pokemon catalog view:', {
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError(
        'Failed to fetch pokemon catalog view',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    return (data ?? []) as PokemonCatalogViewRow[];
  }

  private async fetchUncaughtFromCatalog(
    params: UncaughtCollectionParams,
  ): Promise<CollectionListResult> {
    const { excludeIds, type, sort, order, limit, offset } = params;
    const catalog = await this.fetchPokemonCatalogRows({ type, sort, order });
    const uncaught = catalog.filter(
      (pokemon) => typeof pokemon.pokemon_id === 'number' && !excludeIds.has(pokemon.pokemon_id),
    );
    const total = uncaught.length;
    const slice = uncaught.slice(offset, offset + limit);

    return {
      items: slice.map((pokemon) => this.mapCatalogRowToPlaceholder(pokemon)),
      total,
    };
  }

  private async fetchFullCollection(params: FullCollectionParams): Promise<CollectionListResult> {
    const catalog = await this.fetchPokemonCatalogRows({
      type: params.type,
      sort: params.sort,
      order: params.order,
    });
    const captured = await this.fetchCapturedFromView({
      userId: params.userId,
      type: params.type,
      shiny: false,
      sort: params.sort,
      order: params.order,
      limit: CollectionService.GEN1_POKEMON_COUNT,
      offset: 0,
    });

    const capturedMap = new Map<number, CollectionItemDto[]>();
    for (const item of captured.items) {
      const list = capturedMap.get(item.pokemonId);
      if (list) {
        list.push(item);
      } else {
        capturedMap.set(item.pokemonId, [item]);
      }
    }

    const merged: CollectionItemDto[] = [];
    for (const row of catalog) {
      if (typeof row.pokemon_id !== 'number') {
        continue;
      }

      const capturedEntries = capturedMap.get(row.pokemon_id);
      if (capturedEntries && capturedEntries.length > 0) {
        capturedEntries.sort((a, b) => {
          const score = (value: CollectionItemDto) => (value.variant === 'normal' ? 0 : 1);
          return score(a) - score(b);
        });
        merged.push(...capturedEntries);
        continue;
      }

      merged.push(this.mapCatalogRowToPlaceholder(row));
    }

    return {
      items: merged,
      total: catalog.length,
    };
  }

  private mapCapturedRow(row: MyCollectionViewRow): CollectionItemDto {
    if (typeof row.pokemon_id !== 'number' || typeof row.pokemon_name !== 'string') {
      throw new CollectionServiceError(
        'Invalid collection row returned from view',
        'DATA_TRANSFORMATION_FAILED',
        {
          pokemonId: row.pokemon_id ?? undefined,
        },
      );
    }

    return {
      pokemonId: row.pokemon_id,
      name: row.pokemon_name,
      sprites: this.parseSprites(row.sprites, { pokemonId: row.pokemon_id }),
      types: this.mapTypeDetails(row.type_details),
      variant: row.variant ?? 'normal',
      capturedAt: row.captured_at ?? null,
      isCaught: true,
    };
  }

  private mapCatalogRowToPlaceholder(row: PokemonCatalogViewRow): CollectionItemDto {
    if (typeof row.pokemon_id !== 'number' || typeof row.pokemon_name !== 'string') {
      throw new CollectionServiceError(
        'Invalid catalog row returned from view',
        'DATA_TRANSFORMATION_FAILED',
        {
          pokemonId: row.pokemon_id ?? undefined,
        },
      );
    }

    return {
      pokemonId: row.pokemon_id,
      name: row.pokemon_name,
      sprites: this.parseSprites(row.sprites, { pokemonId: row.pokemon_id }),
      types: this.mapTypeDetails(row.type_details),
      variant: 'normal',
      capturedAt: null,
      isCaught: false,
    };
  }

  private mapTypeDetails(details: unknown): PokemonTypeDto[] {
    if (!Array.isArray(details)) {
      return [];
    }

    return (details as unknown[])
      .filter((detail): detail is TypeDetailJson => this.isTypeDetail(detail))
      .map((detail) => ({
        id: detail.type_id,
        name: detail.type_name,
        slot: detail.slot,
      }))
      .sort((a, b) => a.slot - b.slot);
  }

  private isTypeDetail(detail: unknown): detail is TypeDetailJson {
    if (!detail || typeof detail !== 'object') {
      return false;
    }

    const value = detail as Partial<TypeDetailJson>;
    return (
      typeof value.type_id === 'number' &&
      typeof value.type_name === 'string' &&
      typeof value.slot === 'number'
    );
  }

  private parseSprites(value: unknown, context: { pokemonId?: number }): PokemonSpritesDto {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const frontDefault = record.front_default;
      const frontShiny = record.front_shiny;

      if (typeof frontDefault === 'string' && typeof frontShiny === 'string') {
        return {
          front_default: frontDefault,
          front_shiny: frontShiny,
        };
      }
    }

    throw new CollectionServiceError(
      'Failed to transform sprite data',
      'DATA_TRANSFORMATION_FAILED',
      context,
    );
  }

  private getCapturedSortColumn(sort: SortField): 'pokemon_id' | 'pokemon_name' | 'captured_at' {
    switch (sort) {
      case 'name':
        return 'pokemon_name';
      case 'date':
        return 'captured_at';
      case 'pokedex':
      default:
        return 'pokemon_id';
    }
  }

  private getCatalogSortColumn(sort: SortField): 'pokemon_id' | 'pokemon_name' {
    switch (sort) {
      case 'name':
        return 'pokemon_name';
      case 'pokedex':
      case 'date':
      default:
        return 'pokemon_id';
    }
  }

  /**
   * Map recent capture database row to DTO
   */
  private mapRecentCapture(row: RecentCaptureRow): RecentCaptureDto {
    try {
      const sprites = row.pokemon.sprites as PokemonSpritesDto;
      const sprite = row.variant === 'shiny' ? sprites.front_shiny : sprites.front_default;

      return {
        pokemonId: row.pokemon_id,
        name: row.pokemon.name,
        sprite,
        variant: row.variant,
        capturedAt: row.captured_at ?? new Date().toISOString(),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to map recent capture:', {
        pokemonId: row?.pokemon_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CollectionServiceError(
        'Failed to transform recent capture data',
        'DATA_TRANSFORMATION_FAILED',
        {
          pokemonId: row?.pokemon_id,
        },
      );
    }
  }

  private async getCaptureRecord(
    command: CapturePokemonCommand,
  ): Promise<CapturedPokemonRow | null> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('captured_at')
      .eq('user_id', command.userId)
      .eq('pokemon_id', command.pokemonId)
      .eq('variant', command.variant)
      .limit(1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[CollectionService] Failed to fetch capture record:', {
        userId: command.userId,
        pokemonId: command.pokemonId,
        variant: command.variant,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new CollectionServiceError('Failed to fetch capture record', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    return (data?.[0] as CapturedPokemonRow) ?? null;
  }
}
