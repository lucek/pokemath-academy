import type {
  CreateWildEncounterCommand,
  EncounterPokemonDto,
  EncounterResponseDto,
  PokemonSpritesDto,
  PokemonTypeDto,
  QuestionDto,
} from '../../types';
import { createHash, randomUUID } from 'node:crypto';

import type { TypedSupabaseClient } from '../../db/supabase.client';

const SHINY_PROBABILITY = 0.01;
const ATTEMPTS_PER_ENCOUNTER = 3;
const QUESTION_COUNT = 3;
const RNG_DENOMINATOR = 0xffffffff;

type Operator = '+' | '-' | '*';
type RngFn = () => number;

interface ShinyVariantParams {
  userId: string;
  pokemonId: number;
  rng: RngFn;
}

interface EvolutionTargetRelation {
  evolution_id: number;
}

interface BasePokemonRow {
  id: number;
  name: string;
  sprites: unknown;
  flavor_text: string | null;
  pokemon_types: PokemonTypeRelation[];
  evolution_targets: EvolutionTargetRelation[] | null;
}

interface PokemonTypeRelation {
  slot: number;
  types: {
    id: number;
    name: string;
  } | null;
}

export type EncounterServiceErrorCode =
  | 'DATABASE_QUERY_FAILED'
  | 'POKEMON_POOL_EMPTY'
  | 'DATA_TRANSFORMATION_FAILED'
  | 'UNEXPECTED_ERROR'
  | 'BASE_NOT_CAPTURED'
  | 'EVOLUTION_RELATION_NOT_FOUND';

export class EncounterServiceError extends Error {
  constructor(
    message: string,
    public readonly code: EncounterServiceErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EncounterServiceError';
  }
}

/**
 * Service responsible for generating encounters and math questions.
 */
export class EncounterService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Generate a deterministic wild encounter for a user.
   *
   * @param command - user and optional seed context
   */
  async generateWildEncounter(command: CreateWildEncounterCommand): Promise<EncounterResponseDto> {
    try {
      const normalizedSeed = this.normalizeSeed(command);
      const rng = this.createDeterministicRng(normalizedSeed);

      const basePokemonPool = await this.fetchBasePokemonPool();
      if (basePokemonPool.length === 0) {
        throw new EncounterServiceError('Base Pokemon pool is empty', 'POKEMON_POOL_EMPTY');
      }

      const selectedPokemon = this.pickPokemonFromPool(basePokemonPool, rng);
      const isShiny = await this.determineShinyVariant({
        userId: command.userId,
        pokemonId: selectedPokemon.id,
        rng,
      });
      const pokemonDto = this.mapEncounterPokemon(selectedPokemon, isShiny);
      const questions = this.generateMathQuestionsForStage(rng, 1);

      return {
        encounterId: randomUUID(),
        pokemon: pokemonDto,
        questions,
        attemptsRemaining: ATTEMPTS_PER_ENCOUNTER,
      };
    } catch (error) {
      if (error instanceof EncounterServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[EncounterService] Unexpected error in generateWildEncounter:', {
        userId: command.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new EncounterServiceError(
        'Unexpected error while generating wild encounter',
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Generate an evolution encounter for a user given a base and a target evolution.
   * Validates ownership of base Pokemon and existence of base->evolution relation.
   */
  async generateEvolutionEncounter(command: {
    userId: string;
    baseId: number;
    evolutionId: number;
    seed?: string;
  }): Promise<EncounterResponseDto> {
    try {
      const normalizedSeed = this.normalizeSeed({ userId: command.userId, seed: command.seed });
      const rng = this.createDeterministicRng(normalizedSeed);

      await Promise.all([
        this.assertBaseCaptured(command.userId, command.baseId),
        this.assertEvolutionRelation(command.baseId, command.evolutionId),
      ]);

      const targetRow = await this.fetchPokemonById(command.evolutionId);
      if (!targetRow) {
        throw new EncounterServiceError(
          'Evolution target not found',
          'DATA_TRANSFORMATION_FAILED',
          {
            evolutionId: command.evolutionId,
          },
        );
      }

      const mappedRow: BasePokemonRow = {
        id: targetRow.id,
        name: targetRow.name,
        sprites: targetRow.sprites,
        flavor_text: targetRow.flavor_text,
        pokemon_types: targetRow.pokemon_types,
        evolution_targets: null,
      };

      const isShiny = await this.determineShinyVariant({
        userId: command.userId,
        pokemonId: targetRow.id,
        rng,
      });
      const stage = await this.deriveStage(command.evolutionId);
      const pokemonDto = { ...this.mapEncounterPokemon(mappedRow, isShiny), stage };
      const questions = this.generateMathQuestionsForStage(rng, stage);

      return {
        encounterId: randomUUID(),
        pokemon: pokemonDto,
        questions,
        attemptsRemaining: ATTEMPTS_PER_ENCOUNTER,
      };
    } catch (error) {
      if (error instanceof EncounterServiceError) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.error('[EncounterService] Unexpected error in generateEvolutionEncounter:', {
        userId: command.userId,
        baseId: command.baseId,
        evolutionId: command.evolutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new EncounterServiceError(
        'Unexpected error while generating evolution encounter',
        'UNEXPECTED_ERROR',
      );
    }
  }

  private normalizeSeed(command: CreateWildEncounterCommand): string {
    const trimmedSeed = command.seed?.trim();
    if (trimmedSeed && trimmedSeed.length > 0) {
      return `${command.userId}|${trimmedSeed}`;
    }

    return `${command.userId}|${Date.now()}`;
  }

  private createDeterministicRng(seed: string): RngFn {
    let counter = 0;

    return () => {
      const hash = createHash('sha256').update(seed).update(String(counter)).digest();
      counter += 1;
      const value = hash.readUInt32BE(0);
      return value / RNG_DENOMINATOR;
    };
  }

  private async fetchBasePokemonPool(): Promise<BasePokemonRow[]> {
    const { data, error } = await this.supabase
      .from('pokemon')
      .select(
        `
          id,
          name,
          sprites,
          flavor_text,
          pokemon_types (
            slot,
            types (
              id,
              name
            )
          ),
          evolution_targets:pokemon_evolutions!fk_pokemon_evolutions_evolution (
            evolution_id
          )
        `,
      )
      .order('id', { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to fetch base Pokemon pool:', {
        error: error.message,
        code: error.code,
        hint: error.hint,
      });

      throw new EncounterServiceError('Failed to fetch Pokemon data', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    const rows = (data ?? []) as BasePokemonRow[];
    return rows.filter((row) => !row.evolution_targets || row.evolution_targets.length === 0);
  }

  private pickPokemonFromPool(pool: BasePokemonRow[], rng: RngFn): BasePokemonRow {
    const index = Math.floor(rng() * pool.length);
    return pool[Math.max(0, Math.min(pool.length - 1, index))];
  }

  private rollShinyVariant(rng: RngFn): boolean {
    return rng() < SHINY_PROBABILITY;
  }

  private async determineShinyVariant(params: ShinyVariantParams): Promise<boolean> {
    const shinyRolled = this.rollShinyVariant(params.rng);
    if (!shinyRolled) {
      return false;
    }

    return this.hasNormalVariantCapture(params.userId, params.pokemonId);
  }

  private mapEncounterPokemon(row: BasePokemonRow, isShiny: boolean): EncounterPokemonDto {
    try {
      const sprites = row.sprites as PokemonSpritesDto;
      const primaryKey = isShiny ? 'front_shiny' : 'front_default';
      const fallbackKey = isShiny ? 'front_default' : 'front_shiny';

      const sprite =
        this.extractSpriteUrl(sprites, primaryKey) ??
        this.extractSpriteUrl(sprites, fallbackKey) ??
        this.extractSpriteUrl(sprites, 'front_default');

      if (!sprite) {
        throw new EncounterServiceError(
          'Pokemon sprite data is missing',
          'DATA_TRANSFORMATION_FAILED',
          {
            pokemonId: row.id,
          },
        );
      }

      return {
        id: row.id,
        name: row.name,
        sprite,
        isShiny,
        stage: 1,
        flavorText: row.flavor_text ?? null,
        types: this.mapPokemonTypes(row.pokemon_types),
      };
    } catch (error) {
      if (error instanceof EncounterServiceError) {
        throw error;
      }

      throw new EncounterServiceError('Failed to map Pokemon data', 'DATA_TRANSFORMATION_FAILED', {
        pokemonId: row.id,
      });
    }
  }

  private mapPokemonTypes(relations: PokemonTypeRelation[] | null | undefined): PokemonTypeDto[] {
    if (!relations) {
      return [];
    }

    return relations
      .filter(
        (relation): relation is PokemonTypeRelation & { types: { id: number; name: string } } =>
          relation.types != null,
      )
      .map((relation) => ({
        id: relation.types.id,
        name: relation.types.name,
        slot: relation.slot,
      }))
      .sort((a, b) => a.slot - b.slot);
  }

  private extractSpriteUrl(
    sprites: PokemonSpritesDto | undefined,
    key: keyof PokemonSpritesDto,
  ): string | undefined {
    if (!sprites || typeof sprites !== 'object') {
      return undefined;
    }

    const value = sprites[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /**
   * Generate 3 math questions tuned to the provided stage (1..3).
   * Stage 1: baseline difficulty
   * Stage 2: moderate ranges
   * Stage 3: harder ranges and favors multiplication
   */
  private generateMathQuestionsForStage(rng: RngFn, stage: 1 | 2 | 3): QuestionDto[] {
    const questions: QuestionDto[] = [];

    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      const operator = this.pickOperatorForStage(rng, stage);
      const operands = this.generateOperandsForStage(operator, rng, stage);
      const correctAnswer = this.computeAnswer(operator, operands);
      const options = this.buildOptions(correctAnswer, rng);

      const idSeed = `${stage}|${operator}|${operands.operand1}|${operands.operand2}|${index}`;
      const id = createHash('sha1').update(idSeed).digest('hex').slice(0, 12);

      questions.push({
        id,
        question: `${operands.operand1} ${operator} ${operands.operand2} = ?`,
        options,
      });
    }

    return questions;
  }

  private pickOperatorForStage(rng: RngFn, stage: 1 | 2 | 3): Operator {
    if (stage === 1 || stage === 2) {
      return this.pickOperator(rng); // uniform +, -, *
    }

    // Stage 3: 50% *, 25% +, 25% -
    const roll = rng();
    if (roll < 0.5) {
      return '*';
    }
    return roll < 0.75 ? '+' : '-';
  }

  private generateOperandsForStage(
    operator: Operator,
    rng: RngFn,
    stage: 1 | 2 | 3,
  ): { operand1: number; operand2: number } {
    if (operator === '*') {
      if (stage === 1) {
        const operand1 = this.randomInt(rng, 2, 12);
        const operand2 = this.randomInt(rng, 2, 12);
        return { operand1, operand2 };
      }
      if (stage === 2) {
        const operand1 = this.randomInt(rng, 3, 12);
        const operand2 = this.randomInt(rng, 3, 12);
        return { operand1, operand2 };
      }
      // Stage 3 multiplication: both operands 7..12
      const operand1 = this.randomInt(rng, 7, 12);
      const operand2 = this.randomInt(rng, 7, 12);
      return { operand1, operand2 };
    }

    // Addition/Subtraction ranges by stage
    if (stage === 1) {
      const operand1 = this.randomInt(rng, 5, 99);
      const operand2 = this.randomInt(rng, 5, 99);
      if (operator === '-') {
        return operand1 >= operand2
          ? { operand1, operand2 }
          : { operand1: operand2, operand2: operand1 };
      }
      return { operand1, operand2 };
    }
    if (stage === 2) {
      const operand1 = this.randomInt(rng, 10, 120);
      const operand2 = this.randomInt(rng, 10, 120);
      if (operator === '-') {
        return operand1 >= operand2
          ? { operand1, operand2 }
          : { operand1: operand2, operand2: operand1 };
      }
      return { operand1, operand2 };
    }

    // Stage 3 harder ranges
    const operand1 = this.randomInt(rng, 25, 200);
    const operand2 = this.randomInt(rng, 25, 200);
    if (operator === '-') {
      return operand1 >= operand2
        ? { operand1, operand2 }
        : { operand1: operand2, operand2: operand1 };
    }
    return { operand1, operand2 };
  }

  private async assertBaseCaptured(userId: string, baseId: number): Promise<void> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('id')
      .eq('user_id', userId)
      .eq('pokemon_id', baseId)
      .limit(1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to verify base capture:', {
        code: error.code,
        hint: error.hint,
        message: error.message,
        userId,
        baseId,
      });
      throw new EncounterServiceError('Failed to verify base capture', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    if (!data || data.length === 0) {
      throw new EncounterServiceError('Base Pokemon not captured by user', 'BASE_NOT_CAPTURED', {
        userId,
        baseId,
      });
    }
  }

  private async hasNormalVariantCapture(userId: string, pokemonId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('captured_pokemon')
      .select('id')
      .eq('user_id', userId)
      .eq('pokemon_id', pokemonId)
      .eq('variant', 'normal')
      .limit(1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to verify normal capture status:', {
        userId,
        pokemonId,
        code: error.code,
        hint: error.hint,
        message: error.message,
      });

      throw new EncounterServiceError(
        'Failed to verify normal capture status',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    return Array.isArray(data) && data.length > 0;
  }

  private async assertEvolutionRelation(baseId: number, evolutionId: number): Promise<void> {
    const { data, error } = await this.supabase
      .from('pokemon_evolutions')
      .select('base_id, evolution_id')
      .eq('base_id', baseId)
      .eq('evolution_id', evolutionId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to verify evolution relation:', {
        code: error.code,
        hint: error.hint,
        message: error.message,
        baseId,
        evolutionId,
      });
      throw new EncounterServiceError(
        'Failed to verify evolution relation',
        'DATABASE_QUERY_FAILED',
        {
          code: error.code,
          hint: error.hint,
        },
      );
    }

    if (!data) {
      throw new EncounterServiceError(
        'Evolution relation not found',
        'EVOLUTION_RELATION_NOT_FOUND',
        {
          baseId,
          evolutionId,
        },
      );
    }
  }

  private async fetchPokemonById(id: number): Promise<{
    id: number;
    name: string;
    sprites: unknown;
    flavor_text: string | null;
    pokemon_types: PokemonTypeRelation[];
  } | null> {
    const { data, error } = await this.supabase
      .from('pokemon')
      .select(
        `
        id,
        name,
        sprites,
        flavor_text,
        pokemon_types (
          slot,
          types (
            id,
            name
          )
        )
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to fetch Pokemon by id:', {
        id,
        code: error.code,
        hint: error.hint,
        message: error.message,
      });
      throw new EncounterServiceError('Failed to fetch Pokemon data', 'DATABASE_QUERY_FAILED', {
        code: error.code,
        hint: error.hint,
      });
    }

    return (
      (data as unknown as {
        id: number;
        name: string;
        sprites: unknown;
        flavor_text: string | null;
        pokemon_types: PokemonTypeRelation[];
      } | null) ?? null
    );
  }

  private async deriveStage(evolutionId: number): Promise<2 | 3> {
    // Is evolutionId the evolution of something?
    const { data: baseRows, error: e1 } = await this.supabase
      .from('pokemon_evolutions')
      .select('base_id')
      .eq('evolution_id', evolutionId);

    if (e1) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to derive stage (first hop):', {
        evolutionId,
        code: e1.code,
        hint: e1.hint,
        message: e1.message,
      });
      throw new EncounterServiceError('Failed to derive evolution stage', 'DATABASE_QUERY_FAILED', {
        code: e1.code,
        hint: e1.hint,
      });
    }

    const bases = (baseRows ?? []) as { base_id: number }[];
    if (bases.length === 0) {
      // Fallback specified by plan: treat as stage 2
      return 2;
    }

    const baseIds = bases.map((r) => r.base_id);
    const { data: secondHopRows, error: e2 } = await this.supabase
      .from('pokemon_evolutions')
      .select('base_id')
      .in('evolution_id', baseIds)
      .limit(1);

    if (e2) {
      // eslint-disable-next-line no-console
      console.error('[EncounterService] Failed to derive stage (second hop):', {
        evolutionId,
        baseIds,
        code: e2.code,
        hint: e2.hint,
        message: e2.message,
      });
      throw new EncounterServiceError('Failed to derive evolution stage', 'DATABASE_QUERY_FAILED', {
        code: e2.code,
        hint: e2.hint,
      });
    }

    return secondHopRows && secondHopRows.length > 0 ? 3 : 2;
  }

  private generateMathQuestions(rng: RngFn): QuestionDto[] {
    const questions: QuestionDto[] = [];

    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      const operator = this.pickOperator(rng);
      const operands = this.generateOperands(operator, rng);
      const correctAnswer = this.computeAnswer(operator, operands);
      const options = this.buildOptions(correctAnswer, rng);

      const idSeed = `${operator}|${operands.operand1}|${operands.operand2}|${index}`;
      const id = createHash('sha1').update(idSeed).digest('hex').slice(0, 12);

      questions.push({
        id,
        question: `${operands.operand1} ${operator} ${operands.operand2} = ?`,
        options,
      });
    }

    return questions;
  }

  private pickOperator(rng: RngFn): Operator {
    const operators: Operator[] = ['+', '-', '*'];
    const index = Math.floor(rng() * operators.length);
    return operators[Math.max(0, Math.min(operators.length - 1, index))];
  }

  private generateOperands(operator: Operator, rng: RngFn): { operand1: number; operand2: number } {
    if (operator === '*') {
      const operand1 = this.randomInt(rng, 2, 12);
      const operand2 = this.randomInt(rng, 2, 12);
      return { operand1, operand2 };
    }

    const operand1 = this.randomInt(rng, 5, 99);
    const operand2 = this.randomInt(rng, 5, 99);

    if (operator === '-') {
      return operand1 >= operand2
        ? { operand1, operand2 }
        : { operand1: operand2, operand2: operand1 };
    }

    return { operand1, operand2 };
  }

  private computeAnswer(
    operator: Operator,
    operands: { operand1: number; operand2: number },
  ): number {
    if (operator === '+') {
      return operands.operand1 + operands.operand2;
    }

    if (operator === '-') {
      return operands.operand1 - operands.operand2;
    }

    return operands.operand1 * operands.operand2;
  }

  private buildOptions(correctAnswer: number, rng: RngFn): number[] {
    const options = new Set<number>([correctAnswer]);

    while (options.size < 4) {
      const delta = this.randomInt(rng, -12, 12);
      if (delta === 0) {
        continue;
      }

      const candidate = correctAnswer + delta;
      options.add(Math.max(0, candidate));
    }

    return this.shuffle(Array.from(options), rng);
  }

  private shuffle<T>(values: T[], rng: RngFn): T[] {
    const array = [...values];
    for (let index = array.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      const safeSwapIndex = Math.max(0, Math.min(index, swapIndex));
      [array[index], array[safeSwapIndex]] = [array[safeSwapIndex], array[index]];
    }

    return array;
  }

  private randomInt(rng: RngFn, min: number, max: number): number {
    const value = rng();
    return Math.floor(value * (max - min + 1)) + min;
  }
}
