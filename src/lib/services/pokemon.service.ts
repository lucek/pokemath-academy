import type {
  EvolutionLineDto,
  PaginationDto,
  PokemonCaptureStatusDto,
  PokemonDetailDto,
  PokemonListItemDto,
  PokemonListResponseDto,
  PokemonSpritesDto,
  PokemonStatsDto,
  PokemonTypeDto,
  VariantEnum,
} from '../../types';

import type { PokemonListQueryParams } from '../validation/pokemon.schema';
import pokeballSprite from '@/assets/icons/pokeball.png?url';
import type { TypedSupabaseClient } from '../../db/supabase.client';

export type PokemonServiceErrorCode =
  | 'DATABASE_QUERY_FAILED'
  | 'DATA_TRANSFORMATION_FAILED'
  | 'UNEXPECTED_ERROR';

export class PokemonServiceError extends Error {
  constructor(
    message: string,
    public readonly code: PokemonServiceErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PokemonServiceError';
  }
}

const FALLBACK_SPRITE = pokeballSprite;
const EVOLUTION_CHILD_BATCH = 10;

interface PokemonTypeRelation {
  slot: number;
  types: {
    id: number;
    name: string;
  } | null;
}

interface EvolutionPokemonRow {
  id: number;
  name: string;
  sprites: unknown;
}

interface PokemonTypeRow {
  pokemon_id: number;
  slot: number;
  types: {
    id: number;
    name: string;
  } | null;
}

interface PokemonEvolutionRawData {
  base_id: number;
  evolution_id: number;
  pokemon: EvolutionPokemonRow | null;
}

interface PokemonEvolutionWithPokemon extends PokemonEvolutionRawData {
  pokemon: EvolutionPokemonRow;
}

interface PokemonTypeRelationWithType extends PokemonTypeRelation {
  types: {
    id: number;
    name: string;
  };
}

interface PokemonRawData {
  id: number;
  name: string;
  stats: unknown;
  sprites: unknown;
  flavor_text: string | null;
  region: string | null;
  pokemon_types: PokemonTypeRelation[];
}

interface PokemonDetailRawData extends PokemonRawData {
  created_at: string | null;
  pokemon_evolutions: PokemonEvolutionRawData[] | null;
}

interface EvolutionNodeAccumulator {
  summary: EvolutionPokemonRow;
  previous: Set<number>;
  stage: number;
}

interface CapturedPokemonRow {
  pokemon_id: number;
}

/**
 * Service for Pokemon-related operations
 * Handles business logic and database interactions for Pokemon data
 */
export class PokemonService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Get paginated list of Pokemon with optional filtering
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Promise resolving to paginated Pokemon list with metadata
   * @throws PokemonServiceError if database query fails or data transformation fails
   */
  async getPokemonList(params: PokemonListQueryParams): Promise<PokemonListResponseDto> {
    try {
      const { type, search, limit = 50, offset = 0 } = params;

      let query = this.supabase.from('pokemon').select(
        `
          id,
          name,
          stats,
          sprites,
          flavor_text,
          region,
          pokemon_types!inner (
            slot,
            types (
              id,
              name
            )
          )
        `,
        { count: 'exact' },
      );

      if (type != null) {
        query = query.eq('pokemon_types.type_id', type);
      }

      if (search != null && search.trim().length > 0) {
        query = query.textSearch('name', search, {
          type: 'plain',
          config: 'simple',
        });
      }

      query = query.range(offset, offset + limit - 1).order('id', { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[PokemonService] Database query failed:', {
          error: error.message,
          code: error.code,
          params,
          details: error.details,
          hint: error.hint,
        });
        throw new PokemonServiceError('Failed to fetch Pokemon list', 'DATABASE_QUERY_FAILED', {
          code: error.code,
          hint: error.hint,
        });
      }

      const records = (data ?? []) as PokemonRawData[];
      const pokemonList = records.map((pokemon) => this.mapPokemonListItem(pokemon));

      const pagination: PaginationDto = {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      };

      return {
        data: pokemonList,
        pagination,
      };
    } catch (error) {
      if (error instanceof PokemonServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[PokemonService] Unexpected error in getPokemonList:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new PokemonServiceError(
        'Unexpected error while fetching Pokemon list',
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Retrieve detailed Pokemon data with related types and evolutions.
   *
   * @param id - Pokemon identifier (1-151)
   * @returns Pokemon detail DTO or null when not found
   * @throws PokemonServiceError when Supabase fails or mapping fails
   */
  async getPokemonDetail(
    id: number,
    options?: { userId?: string | null },
  ): Promise<PokemonDetailDto | null> {
    try {
      const { data, error } = await this.supabase
        .from('pokemon')
        .select(
          `
            id,
            name,
            stats,
            sprites,
            flavor_text,
            region,
            created_at,
            pokemon_types (
              slot,
              types (
                id,
                name
              )
            ),
            pokemon_evolutions!fk_pokemon_evolutions_base (
              base_id,
              evolution_id,
              trigger,
              pokemon:pokemon!fk_pokemon_evolutions_evolution (
                id,
                name,
                sprites
              )
            )
          `,
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[PokemonService] Failed to fetch Pokemon detail:', {
          id,
          error: error.message,
          code: error.code,
          hint: error.hint,
        });

        throw new PokemonServiceError('Failed to fetch Pokemon detail', 'DATABASE_QUERY_FAILED', {
          code: error.code,
          hint: error.hint,
        });
      }

      if (!data) {
        return null;
      }

      const rawRecord = data as PokemonDetailRawData;
      const { line: evolutionLine, rootId } = await this.buildEvolutionLine(
        rawRecord,
        options?.userId ?? null,
      );
      const captureStatus = await this.resolveCaptureStatus({
        pokemonId: rawRecord.id,
        baseId: rootId,
        userId: options?.userId ?? null,
      });
      return this.mapPokemonDetail(rawRecord, evolutionLine, captureStatus);
    } catch (error) {
      if (error instanceof PokemonServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[PokemonService] Unexpected error in getPokemonDetail:', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new PokemonServiceError(
        'Unexpected error while fetching Pokemon detail',
        'UNEXPECTED_ERROR',
      );
    }
  }

  private mapPokemonDetail(
    pokemon: PokemonDetailRawData,
    evolutionLine: EvolutionLineDto | null,
    captureStatus: PokemonCaptureStatusDto | null,
  ): PokemonDetailDto {
    const base = this.mapPokemonListItem(pokemon);

    return {
      ...base,
      evolution_line: evolutionLine ?? null,
      capture_status: captureStatus,
      created_at: pokemon.created_at ?? null,
    };
  }

  /**
   * Transform single Pokemon entity to DTO
   * Parses JSONB fields and structures related data
   */
  private mapPokemonListItem(pokemon: PokemonRawData): PokemonListItemDto {
    try {
      return {
        id: pokemon.id,
        name: pokemon.name,
        stats: pokemon.stats as PokemonStatsDto,
        sprites: pokemon.sprites as PokemonSpritesDto,
        flavor_text: pokemon.flavor_text,
        types: this.mapPokemonTypes(pokemon.pokemon_types),
        region: pokemon.region,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Data transformation failed:', {
        pokemonId: pokemon?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new PokemonServiceError(
        'Failed to transform Pokemon data',
        'DATA_TRANSFORMATION_FAILED',
        {
          pokemonId: pokemon?.id,
        },
      );
    }
  }

  private mapPokemonTypes(relations: PokemonTypeRelation[]): PokemonTypeDto[] {
    if (!Array.isArray(relations)) {
      return [];
    }

    return relations
      .filter((relation): relation is PokemonTypeRelationWithType =>
        this.hasCompleteTypeRelation(relation),
      )
      .map((relation) => ({
        id: relation.types.id,
        name: relation.types.name,
        slot: relation.slot,
      }))
      .sort((a, b) => a.slot - b.slot);
  }

  private async buildEvolutionLine(
    pokemon: PokemonDetailRawData,
    userId?: string | null,
  ): Promise<{ line: EvolutionLineDto | null; rootId: number }> {
    const rootId = await this.findChainRootId(pokemon.id);
    const rootPokemon = await this.resolveRootPokemonSummary(pokemon, rootId);

    const nodes = new Map<number, EvolutionNodeAccumulator>();
    nodes.set(rootId, {
      summary: rootPokemon,
      previous: new Set<number>(),
      stage: 1,
    });

    const pendingBaseIds = new Set<number>([rootId]);
    const processedBaseIds = new Set<number>();

    await this.populateEvolutionNodes(nodes, pendingBaseIds, processedBaseIds);

    const orderedNodes = this.orderEvolutionNodes(nodes);

    const nodeIds = orderedNodes.map(([id]) => id);
    const [ownedSet, typeMap] = await Promise.all([
      this.resolveOwnedPokemonSet(nodeIds, userId),
      this.fetchTypesForPokemon(nodeIds),
    ]);

    const evolutions = orderedNodes.map(([id, meta]) => {
      const baseId = this.getPrimaryBaseId(meta.previous);
      const inCollection = ownedSet.has(id);
      const canEvolve = this.canEvolve(meta.previous, ownedSet);

      return {
        id,
        name: meta.summary.name,
        sprite: this.getSpriteUrl(meta.summary.sprites),
        types: typeMap.get(id) ?? [],
        in_collection: inCollection,
        is_current: id === pokemon.id,
        base_id: baseId,
        can_evolve: canEvolve,
      };
    });

    const current = evolutions.find((entry) => entry.is_current) ?? {
      id: pokemon.id,
      name: pokemon.name,
      sprite: this.getSpriteUrl(pokemon.sprites),
      in_collection: ownedSet.has(pokemon.id),
      is_current: true,
    };

    return {
      line: {
        pokemon: {
          id: current.id,
          name: current.name,
          sprite: current.sprite,
          in_collection: current.in_collection,
        },
        evolutions,
      },
      rootId,
    };
  }

  private getPrimaryBaseId(previous: Set<number>): number | null {
    if (previous.size === 0) {
      return null;
    }
    const sorted = Array.from(previous).sort((a, b) => a - b);
    return sorted[0] ?? null;
  }

  private canEvolve(previous: Set<number>, ownedSet: Set<number>): boolean {
    if (previous.size === 0) {
      return false;
    }
    for (const prevId of previous) {
      if (!ownedSet.has(prevId)) {
        return false;
      }
    }
    return true;
  }

  private async populateEvolutionNodes(
    nodes: Map<number, EvolutionNodeAccumulator>,
    pendingBaseIds: Set<number>,
    processedBaseIds: Set<number>,
  ): Promise<void> {
    while (pendingBaseIds.size > 0) {
      const batch = Array.from(pendingBaseIds).slice(0, EVOLUTION_CHILD_BATCH);
      batch.forEach((id) => pendingBaseIds.delete(id));

      const children = await this.fetchEvolutionChildren(batch);
      for (const child of children) {
        this.processChildEvolution(child, nodes, pendingBaseIds, processedBaseIds);
      }

      batch.forEach((id) => processedBaseIds.add(id));
    }
  }

  private processChildEvolution(
    child: PokemonEvolutionRawData,
    nodes: Map<number, EvolutionNodeAccumulator>,
    pendingBaseIds: Set<number>,
    processedBaseIds: Set<number>,
  ): void {
    if (!this.hasEvolutionPokemon(child)) {
      return;
    }

    const parentMeta = nodes.get(child.base_id);
    if (parentMeta === undefined) {
      return;
    }

    const childPokemon = child.pokemon;
    const childId = childPokemon.id;
    const childStage = parentMeta.stage + 1;

    let childMeta = nodes.get(childId);
    if (childMeta === undefined) {
      childMeta = {
        summary: childPokemon,
        previous: new Set<number>(),
        stage: childStage,
      };
      nodes.set(childId, childMeta);
    } else {
      childMeta.stage = Math.max(childMeta.stage, childStage);
    }

    childMeta.previous.add(child.base_id);

    if (processedBaseIds.has(childId)) {
      return;
    }
    pendingBaseIds.add(childId);
  }

  private orderEvolutionNodes(
    nodes: Map<number, EvolutionNodeAccumulator>,
  ): [number, EvolutionNodeAccumulator][] {
    return Array.from(nodes.entries()).sort((a, b) => {
      const stageDiff = a[1].stage - b[1].stage;
      if (stageDiff !== 0) {
        return stageDiff;
      }
      return a[0] - b[0];
    });
  }

  private async resolveRootPokemonSummary(
    pokemon: PokemonDetailRawData,
    rootId: number,
  ): Promise<EvolutionPokemonRow> {
    if (rootId === pokemon.id) {
      return { id: pokemon.id, name: pokemon.name, sprites: pokemon.sprites };
    }

    const summary = await this.fetchPokemonSummary(rootId);
    if (summary) {
      return summary;
    }

    return { id: pokemon.id, name: pokemon.name, sprites: pokemon.sprites };
  }

  private async fetchOwnedPokemonIds(pokemonIds: number[], userId: string): Promise<Set<number>> {
    if (pokemonIds.length === 0) {
      return new Set<number>();
    }

    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('pokemon_id')
      .eq('user_id', userId)
      .in('pokemon_id', pokemonIds);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Failed to load capture ownership:', {
        pokemonIds,
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new PokemonServiceError('Failed to load capture ownership', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    const rows = (data ?? []) as CapturedPokemonRow[];
    return new Set(rows.map((row) => row.pokemon_id));
  }

  private async resolveCaptureStatus(params: {
    pokemonId: number;
    baseId: number;
    userId?: string | null;
  }): Promise<PokemonCaptureStatusDto | null> {
    const { pokemonId, baseId, userId } = params;
    if (!userId) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('pokemon_id, variant, captured_at')
      .eq('user_id', userId)
      .in('pokemon_id', [pokemonId, baseId]);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Failed to load capture status:', {
        pokemonId,
        baseId,
        userId,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });
      throw new PokemonServiceError('Failed to load capture status', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    const rows = (data ?? []).filter(
      (row): row is { pokemon_id: number; variant: VariantEnum; captured_at: string | null } =>
        row?.pokemon_id != null && typeof row.variant === 'string',
    );

    const owned = rows
      .filter((row) => row.pokemon_id === pokemonId)
      .map((row) => ({
        variant: row.variant === 'shiny' ? 'shiny' : ('normal' as VariantEnum),
        capturedAt: row.captured_at ?? null,
      }));

    const isBaseCaught = rows.some((row) => row.pokemon_id === baseId);

    if (!isBaseCaught && owned.length === 0) {
      return {
        baseId,
        isBaseCaught: false,
        owned: [],
      };
    }

    return {
      baseId,
      isBaseCaught,
      owned,
    };
  }

  private async resolveOwnedPokemonSet(
    pokemonIds: number[],
    userId?: string | null,
  ): Promise<Set<number>> {
    if (!userId || pokemonIds.length === 0) {
      return new Set<number>();
    }
    return this.fetchOwnedPokemonIds(pokemonIds, userId);
  }

  private async findChainRootId(pokemonId: number): Promise<number> {
    let currentId = pokemonId;
    const visited = new Set<number>();

    while (true) {
      if (visited.has(currentId)) {
        return currentId;
      }
      visited.add(currentId);

      const { data, error } = await this.supabase
        .from('pokemon_evolutions')
        .select('base_id')
        .eq('evolution_id', currentId)
        .order('base_id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[PokemonService] Failed to resolve evolution root:', {
          pokemonId,
          currentId,
          error: error.message,
          code: error.code,
          hint: error.hint,
        });
        throw new PokemonServiceError(
          'Failed to resolve evolution chain root',
          'DATABASE_QUERY_FAILED',
          {
            code: error.code,
            hint: error.hint,
          },
        );
      }

      if (!data?.base_id) {
        return currentId;
      }

      currentId = data.base_id;
    }
  }

  private async fetchPokemonSummary(id: number): Promise<EvolutionPokemonRow | null> {
    const { data, error } = await this.supabase
      .from('pokemon')
      .select(
        `
          id,
          name,
          sprites
        `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Failed to load pokemon summary:', {
        id,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });
      throw new PokemonServiceError('Failed to load pokemon summary', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    if (!data) {
      return null;
    }

    return data as EvolutionPokemonRow;
  }

  private async fetchEvolutionChildren(baseIds: number[]): Promise<PokemonEvolutionRawData[]> {
    if (baseIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('pokemon_evolutions')
      .select(
        `
          base_id,
          evolution_id,
          pokemon:pokemon!fk_pokemon_evolutions_evolution (
            id,
            name,
            sprites
          )
        `,
      )
      .in('base_id', baseIds);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Failed to expand evolution chain:', {
        baseIds,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new PokemonServiceError('Failed to expand evolution chain', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    return (data ?? []) as PokemonEvolutionRawData[];
  }

  private getSpriteUrl(sprites: unknown): string {
    if (sprites && typeof sprites === 'object') {
      const sprite = (sprites as Record<string, unknown>).front_default;
      if (typeof sprite === 'string') {
        return sprite;
      }
    }

    return FALLBACK_SPRITE;
  }

  private hasEvolutionPokemon(
    evolution: PokemonEvolutionRawData,
  ): evolution is PokemonEvolutionWithPokemon {
    return evolution?.pokemon != null;
  }

  private hasCompleteTypeRelation(
    relation: PokemonTypeRelation,
  ): relation is PokemonTypeRelationWithType {
    return relation?.types != null;
  }

  private async fetchTypesForPokemon(pokemonIds: number[]): Promise<Map<number, PokemonTypeDto[]>> {
    const result = new Map<number, PokemonTypeDto[]>();
    if (pokemonIds.length === 0) {
      return result;
    }

    const { data, error } = await this.supabase
      .from('pokemon_types')
      .select(
        `
          pokemon_id,
          slot,
          types:types (
            id,
            name
          )
        `,
      )
      .in('pokemon_id', pokemonIds);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[PokemonService] Failed to load pokemon types for evolution chain:', {
        pokemonIds,
        error: error.message,
        code: error.code,
        hint: error.hint,
      });
      throw new PokemonServiceError('Failed to load pokemon types', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    const rows = (data ?? []) as PokemonTypeRow[];
    for (const row of rows) {
      if (!row.types) {
        continue;
      }
      const bucket = result.get(row.pokemon_id) ?? [];
      bucket.push({
        id: row.types.id,
        name: row.types.name,
        slot: row.slot,
      });
      result.set(row.pokemon_id, bucket);
    }

    for (const [, list] of result) {
      list.sort((a, b) => a.slot - b.slot);
    }

    return result;
  }
}
