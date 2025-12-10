import { EncounterService, EncounterServiceError } from './encounter.service';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseQuestion } from '../encounters/session';

const createService = (): EncounterService => new EncounterService({} as never);

const accessPrivate = <T>(instance: object, key: string): T =>
  (instance as unknown as Record<string, T>)[key];

const stage3Rng = (): (() => number) => {
  const values = [
    0.1, // q1 op => *
    0.2,
    0.3,
    0.1,
    0.2,
    0.3,
    0.4,
    0.5,
    0.6,
    0.1, // q2 op => *
    0.25,
    0.35,
    0.4,
    0.45,
    0.55,
    0.65,
    0.75,
    0.85,
    0.2, // q3 op => *
    0.15,
    0.55,
    0.05,
    0.15,
    0.25,
    0.35,
    0.45,
    0.55,
  ];

  let index = 0;
  return () => {
    const value = values[index] ?? ((index * 48271) % 0xffff) / 0xffff;
    index += 1;
    return value;
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EncounterService.createDeterministicRng', () => {
  it('returns identical sequences for the same seed', () => {
    const service = createService();
    const createRng = accessPrivate<(seed: string) => () => number>(
      service,
      'createDeterministicRng',
    );

    const rngA = createRng('seed-123');
    const rngB = createRng('seed-123');

    const seqA = [rngA(), rngA(), rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB(), rngB(), rngB()];

    expect(seqA).toEqual(seqB);
  });

  it('returns different sequences for different seeds', () => {
    const service = createService();
    const createRng = accessPrivate<(seed: string) => () => number>(
      service,
      'createDeterministicRng',
    );

    const rngA = createRng('seed-1');
    const rngB = createRng('seed-2');

    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];

    expect(seqA).not.toEqual(seqB);
  });
});

describe('EncounterService.generateMathQuestionsForStage', () => {
  it('creates three unique questions with non-negative, unique options', () => {
    const service = createService();
    const generateForStage = accessPrivate<(rng: () => number, stage: 1 | 2 | 3) => unknown[]>(
      service,
      'generateMathQuestionsForStage',
    ).bind(service);

    const questions = generateForStage(stage3Rng(), 3);
    const ids = questions.map((q) => (q as { id: string }).id);

    expect(questions).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);

    for (const question of questions as { question: string; options: number[] }[]) {
      const optionSet = new Set(question.options);
      expect(optionSet.size).toBe(4);
      expect(question.options.every((opt) => opt >= 0)).toBe(true);
    }
  });

  it('favors multiplication on stage 3 and respects operand ranges', () => {
    const service = createService();
    const generateForStage = accessPrivate<(rng: () => number, stage: 1 | 2 | 3) => unknown[]>(
      service,
      'generateMathQuestionsForStage',
    ).bind(service);

    const questions = generateForStage(stage3Rng(), 3);

    let multiplyCount = 0;
    for (const question of questions as { question: string }[]) {
      const parsed = parseQuestion(question.question);
      expect(parsed).not.toBeNull();
      if (!parsed) continue;

      if (parsed.operator === '*') {
        multiplyCount += 1;
        expect(parsed.operand1).toBeGreaterThanOrEqual(7);
        expect(parsed.operand1).toBeLessThanOrEqual(12);
        expect(parsed.operand2).toBeGreaterThanOrEqual(7);
        expect(parsed.operand2).toBeLessThanOrEqual(12);
      } else {
        expect(parsed.operand1).toBeGreaterThanOrEqual(25);
        expect(parsed.operand1).toBeLessThanOrEqual(200);
        expect(parsed.operand2).toBeGreaterThanOrEqual(25);
        expect(parsed.operand2).toBeLessThanOrEqual(200);
        if (parsed.operator === '-') {
          expect(parsed.operand1).toBeGreaterThanOrEqual(parsed.operand2);
        }
      }
    }

    expect(multiplyCount).toBeGreaterThan(questions.length / 2);
  });
});

describe('EncounterService.buildOptions', () => {
  it('returns four distinct options including the correct answer', () => {
    const service = createService();
    const buildOptions = accessPrivate<(correct: number, rng: () => number) => number[]>(
      service,
      'buildOptions',
    ).bind(service);

    const rng = (() => {
      let i = 0;
      return () => (i++ * 0.19) % 1;
    })();

    const options = buildOptions(42, rng);

    expect(options).toContain(42);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
  });
});

describe('EncounterService.mapEncounterPokemon', () => {
  it('returns a sprite when front_default exists', () => {
    const service = createService();
    const mapEncounterPokemon = accessPrivate<(row: unknown, isShiny: boolean) => unknown>(
      service,
      'mapEncounterPokemon',
    ).bind(service);

    const result = mapEncounterPokemon(
      {
        id: 1,
        name: 'pikachu',
        sprites: { front_default: '/default.png', front_shiny: '/shiny.png' },
        flavor_text: 'electric mouse',
        pokemon_types: [],
      },
      false,
    ) as { sprite: string; isShiny: boolean };

    expect(result.sprite).toBe('/default.png');
    expect(result.isShiny).toBe(false);
  });

  it('uses fallback sprite and marks shiny when primary is missing', () => {
    const service = createService();
    const mapEncounterPokemon = accessPrivate<(row: unknown, isShiny: boolean) => unknown>(
      service,
      'mapEncounterPokemon',
    ).bind(service);

    const result = mapEncounterPokemon(
      {
        id: 2,
        name: 'umbreon',
        sprites: { front_default: '/default.png', front_shiny: '' },
        flavor_text: null,
        pokemon_types: [],
      },
      true,
    ) as { sprite: string; isShiny: boolean };

    expect(result.sprite).toBe('/default.png');
    expect(result.isShiny).toBe(true);
  });

  it('throws DATA_TRANSFORMATION_FAILED when no sprite is available', () => {
    const service = createService();
    const mapEncounterPokemon = accessPrivate<(row: unknown, isShiny: boolean) => unknown>(
      service,
      'mapEncounterPokemon',
    ).bind(service);

    expect(() =>
      mapEncounterPokemon(
        {
          id: 3,
          name: 'missingno',
          sprites: { front_default: '', front_shiny: '' },
          flavor_text: null,
          pokemon_types: [],
        },
        false,
      ),
    ).toThrowError(
      new EncounterServiceError('Pokemon sprite data is missing', 'DATA_TRANSFORMATION_FAILED'),
    );
  });
});

describe('EncounterService.generateWildEncounter', () => {
  const basePokemon = {
    id: 25,
    name: 'pikachu',
    sprites: { front_default: '/default.png', front_shiny: '/shiny.png' },
    flavor_text: null,
    pokemon_types: [],
    evolution_targets: null,
  };

  const buildService = (ownsNormalVariant: boolean): EncounterService => {
    const service = new EncounterService({} as never);
    const serviceWithPrivates = service as unknown as {
      fetchBasePokemonPool: () => Promise<unknown[]>;
      pickPokemonFromPool: () => unknown;
      generateMathQuestionsForStage: () => unknown[];
      rollShinyVariant: () => boolean;
      hasNormalVariantCapture: (userId: string, pokemonId: number) => Promise<boolean>;
    };

    vi.spyOn(serviceWithPrivates, 'fetchBasePokemonPool').mockResolvedValue([basePokemon]);
    vi.spyOn(serviceWithPrivates, 'pickPokemonFromPool').mockReturnValue(basePokemon);
    vi.spyOn(serviceWithPrivates, 'generateMathQuestionsForStage').mockReturnValue([]);
    vi.spyOn(serviceWithPrivates, 'rollShinyVariant').mockReturnValue(true);
    vi.spyOn(serviceWithPrivates, 'hasNormalVariantCapture').mockResolvedValue(ownsNormalVariant);

    return service;
  };

  it('blocks shiny encounters when the normal variant is not owned', async () => {
    const service = buildService(false);

    const encounter = await service.generateWildEncounter({ userId: 'user-1', seed: 'seed' });

    expect(encounter.pokemon.isShiny).toBe(false);
    expect(encounter.pokemon.id).toBe(basePokemon.id);
  });

  it('allows shiny encounters only after the normal variant is owned', async () => {
    const service = buildService(true);

    const encounter = await service.generateWildEncounter({ userId: 'user-2', seed: 'seed' });

    expect(encounter.pokemon.isShiny).toBe(true);
    expect(encounter.pokemon.id).toBe(basePokemon.id);
  });
});
