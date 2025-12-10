import type {
  EncounterResponseDto,
  EncounterSubmitResponseDto,
  VariantEnum,
  PokemonTypeDto,
} from '@/types';

export type EncounterKind = 'wild' | 'evolution';

export interface EncounterPokemonViewModel {
  id: number;
  name: string;
  sprite: string;
  isShiny: boolean;
  stage: 1 | 2 | 3;
  variantLabel: 'Normal' | 'Shiny';
  flavorText: string | null;
  types: PokemonTypeDto[];
}

export interface QuestionViewModel {
  id: string;
  text: string;
  options: number[]; // length = 4
}

export type ResultViewModel =
  | {
      kind: 'success';
      result: 'captured' | 'already_captured';
      score: { correct: number; total: number };
      pokemon: { id: number; name: string; sprite: string; variant: 'normal' | 'shiny' };
      newCapture: boolean;
      message?: string;
    }
  | {
      kind: 'failure';
      result: 'failed';
      score: { correct: number; total: number };
      attemptsRemaining: number;
      canRetry: boolean;
      message: string;
    };

export type EncounterUiPhase = 'idle' | 'question' | 'submitting' | 'result' | 'error';

export interface EncounterUiState {
  isOpen: boolean;
  phase: EncounterUiPhase;
  encounterType: EncounterKind;
  isOnline: boolean;
  encounterId?: string;
  pokemon?: EncounterPokemonViewModel;
  questions: QuestionViewModel[];
  currentIndex: number; // 0..2
  answers: { questionId: string; selectedOption: number }[]; // 1..4
  attemptsRemaining: number;
  lastResult?: ResultViewModel;
  error?: string;
  originPokemonId?: number;
}

export function mapEncounterDtoToVm(dto: EncounterResponseDto): {
  encounterId: string;
  pokemon: EncounterPokemonViewModel;
  questions: QuestionViewModel[];
  attemptsRemaining: number;
} {
  const pokemonVm: EncounterPokemonViewModel = {
    id: dto.pokemon.id,
    name: dto.pokemon.name,
    sprite: dto.pokemon.sprite,
    isShiny: dto.pokemon.isShiny,
    stage: dto.pokemon.stage,
    variantLabel: dto.pokemon.isShiny ? 'Shiny' : 'Normal',
    flavorText: dto.pokemon.flavorText ?? null,
    types: dto.pokemon.types ?? [],
  };

  const questionsVm: QuestionViewModel[] = dto.questions.map((q) => ({
    id: q.id,
    text: q.question,
    options: q.options.slice(0, 4),
  }));

  return {
    encounterId: dto.encounterId,
    pokemon: pokemonVm,
    questions: questionsVm,
    attemptsRemaining: dto.attemptsRemaining,
  };
}

export function mapSubmitDtoToResultVm(response: EncounterSubmitResponseDto): ResultViewModel {
  if (response.success) {
    const variant: 'normal' | 'shiny' =
      response.pokemon.variant === ('shiny' as VariantEnum) ? 'shiny' : 'normal';
    return {
      kind: 'success',
      result: response.result,
      score: response.score,
      pokemon: {
        id: response.pokemon.id,
        name: response.pokemon.name,
        sprite: response.pokemon.sprite,
        variant,
      },
      newCapture: response.newCapture,
      message: 'message' in response ? response.message : undefined,
    };
  }

  return {
    kind: 'failure',
    result: 'failed',
    score: response.score,
    attemptsRemaining: response.attemptsRemaining,
    canRetry: response.canRetry,
    message: response.message,
  };
}
