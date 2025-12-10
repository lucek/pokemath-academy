import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  EncounterResponseDto,
  EncounterSubmitRequestDto,
  EncounterSubmitResponseDto,
  ErrorResponseDto,
} from '@/types';
import {
  mapEncounterDtoToVm,
  mapSubmitDtoToResultVm,
  type EncounterKind,
  type EncounterUiState,
  type ResultViewModel,
} from '@/components/encounter/types';

type State = EncounterUiState;

interface Actions {
  openModal: () => void;
  closeModal: () => void;
  setOnline: (isOnline: boolean) => void;
  startWildEncounter: (seed?: string) => Promise<void>;
  startEvolutionEncounter: (
    dto: EncounterResponseDto,
    options?: { originPokemonId?: number },
  ) => void;
  selectAnswer: (selectedOption: number) => void;
  submit: () => Promise<void>;
  retry: () => Promise<void>;
  newEncounter: () => Promise<void>;
  reset: () => void;
}

export type EncounterStore = State & { actions: Actions };

const initialState: State = {
  isOpen: false,
  phase: 'idle',
  encounterType: 'wild',
  isOnline: true,
  encounterId: undefined,
  pokemon: undefined,
  questions: [],
  currentIndex: 0,
  answers: [],
  attemptsRemaining: 0,
  lastResult: undefined,
  error: undefined,
  originPokemonId: undefined,
};

async function startWildEncounterApi(seed?: string): Promise<EncounterResponseDto> {
  const res = await fetch('/api/encounters/wild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seed ? { seed } : {}),
  });

  if (!res.ok) {
    const body = (await safeJson(res)) as ErrorResponseDto | undefined;
    const message = body?.error?.message ?? `Failed to start encounter (HTTP ${res.status})`;
    throw new Error(message);
  }

  return (await res.json()) as EncounterResponseDto;
}

async function submitEncounterApi(
  payload: EncounterSubmitRequestDto,
): Promise<EncounterSubmitResponseDto> {
  const res = await fetch('/api/encounters/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await safeJson(res)) as ErrorResponseDto | undefined;
    const message = body?.error?.message ?? `Failed to submit answers (HTTP ${res.status})`;
    throw new Error(message);
  }

  return (await res.json()) as EncounterSubmitResponseDto;
}

async function safeJson(res: Response): Promise<unknown | undefined> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function buildEncounterState(
  dto: EncounterResponseDto,
  encounterType: EncounterKind,
  originPokemonId?: number,
) {
  const mapped = mapEncounterDtoToVm(dto);
  return {
    isOpen: true,
    phase: 'question' as const,
    encounterType,
    encounterId: mapped.encounterId,
    pokemon: mapped.pokemon,
    questions: mapped.questions,
    currentIndex: 0,
    answers: [],
    attemptsRemaining: mapped.attemptsRemaining,
    lastResult: undefined,
    error: undefined,
    originPokemonId,
  };
}

export const useEncounterStore = create<EncounterStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      actions: {
        openModal: () => set({ isOpen: true }),
        closeModal: () => set({ isOpen: false }),
        setOnline: (isOnline: boolean) => set({ isOnline }),

        startWildEncounter: async (seed?: string) => {
          const { isOnline } = get();
          if (!isOnline) {
            set({ error: 'You are offline. Try again when you are back online.' });
            return;
          }

          try {
            const dto = await startWildEncounterApi(seed);
            set(buildEncounterState(dto, 'wild'));
          } catch (error) {
            set({
              phase: 'error',
              error: error instanceof Error ? error.message : 'Failed to start encounter.',
            });
          }
        },

        startEvolutionEncounter: (
          dto: EncounterResponseDto,
          options?: { originPokemonId?: number },
        ) => {
          set(buildEncounterState(dto, 'evolution', options?.originPokemonId));
        },

        selectAnswer: (selectedOption: number) => {
          const state = get();
          if (state.phase !== 'question') {
            return;
          }
          if (selectedOption < 1 || selectedOption > 4) {
            return;
          }
          const currentQuestion = state.questions[state.currentIndex];
          if (!currentQuestion) {
            return;
          }

          const newAnswers = [
            ...state.answers,
            { questionId: currentQuestion.id, selectedOption: selectedOption },
          ];
          const nextIndex = state.currentIndex + 1;
          const isComplete = nextIndex >= state.questions.length;

          set({
            answers: newAnswers,
            currentIndex: isComplete ? state.currentIndex : nextIndex,
          });

          if (isComplete) {
            void get().actions.submit();
          }
        },

        submit: async () => {
          const state = get();
          if (state.phase !== 'question' || !state.encounterId) {
            return;
          }
          if (state.answers.length !== state.questions.length) {
            return;
          }

          set({ phase: 'submitting' });
          try {
            const response = await submitEncounterApi({
              encounterId: state.encounterId,
              answers: state.answers,
            });
            const result: ResultViewModel = mapSubmitDtoToResultVm(response);
            set({
              phase: 'result',
              lastResult: result,
              error: undefined,
              // attemptsRemaining will be updated only when failure response maps through
              attemptsRemaining:
                result.kind === 'failure' ? result.attemptsRemaining : state.attemptsRemaining,
            });
          } catch (error) {
            set({
              phase: 'error',
              error: error instanceof Error ? error.message : 'Failed to submit answers.',
            });
          }
        },

        retry: async () => {
          const state = get();
          if (state.phase !== 'result') {
            return;
          }
          if (!state.lastResult || state.lastResult.kind !== 'failure') {
            return;
          }
          if (!state.lastResult.canRetry || state.attemptsRemaining <= 0) {
            return;
          }
          if (!state.encounterId || state.questions.length === 0) {
            set({
              phase: 'error',
              error: 'Encounter session expired. Start a new encounter to keep playing.',
            });
            return;
          }

          // Reuse the existing encounter session so the backend can enforce attempt limits.
          set({
            phase: 'question',
            currentIndex: 0,
            answers: [],
            lastResult: undefined,
            error: undefined,
          });
        },

        newEncounter: async () => {
          try {
            const dto = await startWildEncounterApi();
            set(buildEncounterState(dto));
          } catch (error) {
            set({
              phase: 'error',
              error: error instanceof Error ? error.message : 'Failed to start new encounter.',
            });
          }
        },

        reset: () => set({ ...initialState }),
      },
    }),
    { name: 'encounter-ui-store' },
  ),
);
