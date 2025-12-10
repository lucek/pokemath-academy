import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { QuestionCard } from '@/components/encounter/QuestionCard';
import { ResultScreen } from '@/components/encounter/ResultScreen';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';
import type {
  EncounterKind,
  EncounterPokemonViewModel,
  EncounterUiState,
  QuestionViewModel,
  ResultViewModel,
} from '@/components/encounter/types';
import { useNetworkStatus } from '@/components/hooks/useNetworkStatus';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildWavePalette, rgbaFromHex } from '@/lib/type-colors';
import { BasePokemonModal } from '@/components/pokemon/BasePokemonModal';
import {
  PokemonModalHeaderProvider,
  createEncounterModalHeaderConfig,
} from '@/components/pokemon/PokemonModalHeader';

const ENCOUNTER_HISTORY_KEY = 'encounter-modal';
type EncounterStep = 1 | 2 | 3;

interface EncounterHistoryState {
  readonly key: string;
  readonly basePath: string;
}

function getCurrentPath(): string {
  const win = globalThis.window;
  if (!win) {
    return '/';
  }
  return `${win.location.pathname}${win.location.search}${win.location.hash}`;
}

const ENCOUNTER_KIND_SEGMENT: Record<EncounterKind, 'wild' | 'evolution'> = {
  wild: 'wild',
  evolution: 'evolution',
};

function buildEncounterPath(
  phase: EncounterUiState['phase'],
  encounterType: EncounterKind,
): string {
  if (phase === 'result') {
    return '/encounter/result';
  }
  const segment = ENCOUNTER_KIND_SEGMENT[encounterType] ?? 'wild';
  return `/encounter/${segment}`;
}

function useEncounterHistorySync(
  isOpen: boolean,
  phase: EncounterUiState['phase'],
  encounterType: EncounterKind,
  onModalClose: () => void,
): () => void {
  const isBrowser = globalThis.window !== undefined;
  const basePathRef = useRef<string | null>(null);
  const hasHistoryEntryRef = useRef(false);
  const activePathRef = useRef<string | null>(null);

  useEffect(() => {
    const win = globalThis.window;
    if (!isBrowser || !win) {
      return;
    }

    if (!isOpen) {
      basePathRef.current = null;
      hasHistoryEntryRef.current = false;
      activePathRef.current = null;
      return;
    }

    if (!hasHistoryEntryRef.current) {
      const basePath = getCurrentPath();
      basePathRef.current = basePath;
      const nextPath = buildEncounterPath(phase, encounterType);
      const state: EncounterHistoryState = { key: ENCOUNTER_HISTORY_KEY, basePath };
      win.history.pushState(state, '', nextPath);
      hasHistoryEntryRef.current = true;
      activePathRef.current = nextPath;
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.key === ENCOUNTER_HISTORY_KEY) {
        onModalClose();
        return;
      }

      if (hasHistoryEntryRef.current && !win.location.pathname.startsWith('/encounter')) {
        hasHistoryEntryRef.current = false;
        basePathRef.current = null;
        activePathRef.current = null;
        onModalClose();
      }
    };

    win.addEventListener('popstate', handlePopState);
    return () => {
      win.removeEventListener('popstate', handlePopState);
    };
  }, [encounterType, isBrowser, isOpen, onModalClose, phase]);

  useEffect(() => {
    const win = globalThis.window;
    if (!isBrowser || !win || !isOpen || !hasHistoryEntryRef.current) {
      return;
    }
    const nextPath = buildEncounterPath(phase, encounterType);
    if (activePathRef.current === nextPath) {
      return;
    }
    const basePath = basePathRef.current ?? '/';
    const state: EncounterHistoryState = { key: ENCOUNTER_HISTORY_KEY, basePath };
    win.history.replaceState(state, '', nextPath);
    activePathRef.current = nextPath;
  }, [encounterType, isBrowser, isOpen, phase]);

  const closeWithHistory = useCallback(() => {
    const win = globalThis.window;
    if (!isBrowser || !win) {
      onModalClose();
      return;
    }
    const fallbackPath = '/dashboard';
    const targetPath =
      basePathRef.current && !basePathRef.current.startsWith('/encounter')
        ? basePathRef.current
        : fallbackPath;
    const shouldRewritePath =
      hasHistoryEntryRef.current || win.location.pathname.startsWith('/encounter');

    if (
      shouldRewritePath &&
      win.location.pathname + win.location.search + win.location.hash !== targetPath
    ) {
      win.history.replaceState(null, '', targetPath);
    }

    hasHistoryEntryRef.current = false;
    basePathRef.current = null;
    activePathRef.current = null;

    onModalClose();
  }, [isBrowser, onModalClose]);

  return closeWithHistory;
}

interface EncounterModalProps {
  readonly isOpen: boolean;
  readonly onRequestClose: () => void;
}

export function EncounterModal({ isOpen, onRequestClose }: EncounterModalProps) {
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  const {
    phase,
    encounterType,
    pokemon,
    questions,
    currentIndex,
    attemptsRemaining,
    lastResult,
    error,
  } = useEncounterStore((s) => ({
    phase: s.phase,
    encounterType: s.encounterType,
    pokemon: s.pokemon,
    questions: s.questions,
    currentIndex: s.currentIndex,
    attemptsRemaining: s.attemptsRemaining,
    lastResult: s.lastResult,
    error: s.error,
  }));
  const actions = useEncounterStore((s) => s.actions);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);

  useEffect(() => {
    actions.setOnline(isOnline);
  }, [isOnline, actions]);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.kind === 'success') {
      queryClient.invalidateQueries({ queryKey: ['collection'] }).catch(() => {
        /* noop */
      });
      queryClient.invalidateQueries({ queryKey: ['stats'] }).catch(() => {
        /* noop */
      });

      // Always refresh Pokemon detail / capture queries so base forms show captured evolutions.
      queryClient.invalidateQueries({ queryKey: ['pokemon-detail'] }).catch(() => {
        /* noop */
      });
      queryClient.invalidateQueries({ queryKey: ['pokemon-capture-status'] }).catch(() => {
        /* noop */
      });

      if (pokemon) {
        queryClient.invalidateQueries({ queryKey: ['pokemon-detail', pokemon.id] }).catch(() => {
          /* noop */
        });
        queryClient
          .invalidateQueries({ queryKey: ['pokemon-capture-status', pokemon.id] })
          .catch(() => {
            /* noop */
          });
      }
    }
  }, [lastResult, pokemon, queryClient]);

  const canCloseSafely = phase !== 'question';
  const currentStep = useMemo<EncounterStep>(() => {
    const step = Math.min(3, Math.max(1, currentIndex + 1));
    return step as EncounterStep;
  }, [currentIndex]);

  const performClose = useCallback(() => {
    actions.reset();
    onRequestClose();
  }, [actions, onRequestClose]);

  const closeWithHistory = useEncounterHistorySync(isOpen, phase, encounterType, performClose);

  const handleClose = useCallback(() => {
    if (isConfirmingExit) {
      setIsConfirmingExit(false);
      return;
    }
    if (!canCloseSafely) {
      setIsConfirmingExit(true);
      return;
    }
    closeWithHistory();
  }, [canCloseSafely, closeWithHistory, isConfirmingExit]);

  const confirmExit = useCallback(() => {
    setIsConfirmingExit(false);
    closeWithHistory();
  }, [closeWithHistory]);

  const cancelExit = useCallback(() => {
    setIsConfirmingExit(false);
  }, []);

  useEffect(() => {
    if (canCloseSafely && isConfirmingExit) {
      setIsConfirmingExit(false);
    }
  }, [canCloseSafely, isConfirmingExit]);

  const hasPokemon = Boolean(pokemon);
  const exitPalette = useMemo(() => (pokemon ? buildWavePalette(pokemon.types) : null), [pokemon]);
  const separatorAccent = useMemo(() => exitPalette?.accent ?? '#71b1ff', [exitPalette]);
  const exitCardStyle = useMemo<CSSProperties | undefined>(() => {
    if (!exitPalette) return undefined;
    return {
      borderColor: rgbaFromHex(exitPalette.accent, 0.55),
      boxShadow: `0 35px 90px ${rgbaFromHex(exitPalette.accent, 0.35)}`,
      backgroundColor: rgbaFromHex(exitPalette.background, 0.9),
    };
  }, [exitPalette]);
  const exitIconStyle = useMemo<CSSProperties | undefined>(() => {
    if (!exitPalette) return undefined;
    return {
      borderColor: rgbaFromHex(exitPalette.accent, 0.6),
      backgroundColor: rgbaFromHex(exitPalette.accent, 0.15),
    };
  }, [exitPalette]);
  const exitButtonStyles = useMemo(() => {
    if (!exitPalette) return null;
    return {
      primary: {
        backgroundImage: `linear-gradient(130deg, ${exitPalette.start}, ${exitPalette.end})`,
        borderColor: rgbaFromHex(exitPalette.accent, 0.55),
        color: exitPalette.background,
        boxShadow: `0 18px 45px ${rgbaFromHex(exitPalette.accent, 0.35)}`,
      } satisfies CSSProperties,
      secondary: {
        borderColor: rgbaFromHex(exitPalette.accent, 0.4),
        backgroundColor: rgbaFromHex(exitPalette.background, 0.3),
        color: 'white',
        boxShadow: `0 12px 35px ${rgbaFromHex(exitPalette.background, 0.45)}`,
      } satisfies CSSProperties,
    };
  }, [exitPalette]);
  const isSubmitting = phase === 'submitting';
  const isResultPhase = phase === 'result';
  const attemptsLeft = Math.max(0, attemptsRemaining);
  const shouldHideSprite = phase === 'result' && attemptsLeft === 0;
  const waveOpacityClass = useMemo(() => {
    if (!hasPokemon) return '';
    return isResultPhase ? 'opacity-90' : 'opacity-70';
  }, [hasPokemon, isResultPhase]);
  const totalQuestions = questions.length || 3;
  const resultIndicatorColor = useMemo(() => {
    if (!isResultPhase || !lastResult) return null;
    return lastResult.kind === 'success' ? '#4ade80' : '#f87171';
  }, [isResultPhase, lastResult]);
  const indicatorAccent = resultIndicatorColor ?? separatorAccent;

  const exitOverlay = useMemo(() => {
    if (!isConfirmingExit) return null;
    return (
      <div className="flex h-full items-center justify-center bg-black/70 px-4 py-6 sm:px-8">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="encounter-exit-title"
          aria-describedby="encounter-exit-description"
          className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#0f1025]/95 p-6 text-white shadow-2xl"
          style={exitCardStyle}
        >
          <TypeWaveBackground
            types={pokemon?.types ?? []}
            variant="modal"
            className="z-0 opacity-90"
          />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3"
                style={exitIconStyle}
              >
                <AlertTriangle
                  className="size-6 text-amber-300"
                  style={exitPalette ? { color: exitPalette.accent } : undefined}
                  aria-hidden="true"
                />
              </div>
              <div>
                <p id="encounter-exit-title" className="text-lg font-semibold text-white">
                  Leave this encounter?
                </p>
                <p id="encounter-exit-description" className="mt-1 text-sm text-white/80">
                  Your current progress will be lost. You can always start a new encounter later.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={cancelExit}
                className="w-full border-white/30 bg-white/10 text-white hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/15 focus-visible:ring-white/40 sm:w-auto"
                style={exitButtonStyles?.secondary}
              >
                Stay in encounter
              </Button>
              <Button
                variant="outline"
                onClick={confirmExit}
                className="w-full border-transparent font-semibold text-[#0f1025] shadow-lg transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] focus-visible:ring-white/40 sm:w-auto"
                style={exitButtonStyles?.primary}
              >
                Leave encounter
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    cancelExit,
    confirmExit,
    exitButtonStyles,
    exitCardStyle,
    exitIconStyle,
    exitPalette,
    isConfirmingExit,
    pokemon?.types,
  ]);

  const dividerVariant = useMemo(
    () => ({
      kind: 'steps' as const,
      totalSteps: 3,
      currentStep,
      highlightResult: Boolean(resultIndicatorColor),
    }),
    [currentStep, resultIndicatorColor],
  );

  const headerConfig = useMemo(
    () =>
      createEncounterModalHeaderConfig({
        pokemon,
        divider: pokemon
          ? {
              accentColor: indicatorAccent,
              variant: dividerVariant,
            }
          : undefined,
        overlay: exitOverlay,
        contentWaveClassName: waveOpacityClass,
        contentClassName: 'min-h-[420px]',
        backdropClassName: 'z-[150]',
        hideSprite: shouldHideSprite,
        label: 'Encounter dialog',
      }),
    [pokemon, indicatorAccent, dividerVariant, exitOverlay, waveOpacityClass, shouldHideSprite],
  );

  const handleSelectAnswer = useCallback(
    (selected: number) => {
      actions.selectAnswer(selected);
    },
    [actions],
  );

  const handleRetryEncounter = useCallback(() => {
    actions.retry();
  }, [actions]);

  const handleNewEncounter = useCallback(() => {
    actions.newEncounter();
  }, [actions]);

  const handleViewPokemon = useCallback(
    (pokemonId: number) => {
      if (!Number.isFinite(pokemonId)) {
        return;
      }
      closeWithHistory();
      const win = globalThis.window;
      if (!win) {
        return;
      }
      globalThis.setTimeout(() => {
        win.location.assign(`/pokemon/${pokemonId}`);
      }, 280);
    },
    [closeWithHistory],
  );

  const bottomContent = (
    <EncounterModalContent
      phase={phase}
      questions={questions}
      currentIndex={currentIndex}
      currentStep={currentStep}
      totalQuestions={totalQuestions}
      attemptsRemaining={attemptsRemaining}
      lastResult={lastResult}
      isSubmitting={isSubmitting}
      error={error}
      accentColor={exitPalette?.accent}
      pokemon={pokemon}
      onSelectAnswer={handleSelectAnswer}
      onRetryEncounter={handleRetryEncounter}
      onNewEncounter={handleNewEncounter}
      onViewPokemon={handleViewPokemon}
      onClose={handleClose}
    />
  );

  return (
    <PokemonModalHeaderProvider value={headerConfig}>
      <BasePokemonModal isOpen={isOpen} onClose={handleClose} bottomContent={bottomContent} />
    </PokemonModalHeaderProvider>
  );
}

interface EncounterModalContentProps {
  readonly phase: EncounterUiState['phase'];
  readonly questions: QuestionViewModel[];
  readonly currentIndex: number;
  readonly currentStep: EncounterStep;
  readonly totalQuestions: number;
  readonly attemptsRemaining: number;
  readonly lastResult?: ResultViewModel;
  readonly isSubmitting: boolean;
  readonly error?: string;
  readonly accentColor?: string;
  readonly pokemon?: EncounterPokemonViewModel;
  readonly onSelectAnswer: (selected: number) => void;
  readonly onRetryEncounter: () => void;
  readonly onNewEncounter: () => void;
  readonly onViewPokemon?: (pokemonId: number) => void;
  readonly onClose: () => void;
}

function EncounterModalContent({
  phase,
  questions,
  currentIndex,
  currentStep,
  totalQuestions,
  attemptsRemaining,
  lastResult,
  isSubmitting,
  error,
  accentColor,
  pokemon,
  onSelectAnswer,
  onRetryEncounter,
  onNewEncounter,
  onViewPokemon,
  onClose,
}: EncounterModalContentProps) {
  const isQuestionPhase = phase === 'question';
  const isSubmittingPhase = phase === 'submitting';
  const isResultPhase = phase === 'result';
  const currentQuestion = questions[currentIndex];
  const shouldShowQuestionCard = Boolean(currentQuestion) && (isQuestionPhase || isSubmittingPhase);
  const shouldShowResultContent = isResultPhase && Boolean(lastResult);

  const renderStageShell = (content: ReactNode): ReactNode => (
    <div className="relative mx-auto flex h-full w-full max-w-2xl px-2 sm:px-4">
      <div className="relative flex h-full w-full items-center">{content}</div>
    </div>
  );

  let stageContent: ReactNode = null;
  if (shouldShowResultContent && lastResult) {
    stageContent = renderStageShell(
      <div className="w-full">
        <ResultScreen
          result={lastResult}
          pokemon={pokemon}
          attemptsRemaining={attemptsRemaining}
          onRetry={onRetryEncounter}
          onNewEncounter={onNewEncounter}
          onViewPokemon={onViewPokemon}
          onClose={onClose}
        />
      </div>,
    );
  } else if (shouldShowQuestionCard && currentQuestion) {
    stageContent = renderStageShell(
      <div className="w-full">
        <QuestionCard
          question={currentQuestion}
          disabled={!isQuestionPhase}
          onSelect={onSelectAnswer}
          step={currentStep}
          total={totalQuestions}
          accentColor={accentColor}
        />
      </div>,
    );
  }

  return (
    <div className="relative flex flex-1 flex-col gap-4">
      {isSubmitting ? (
        <output
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/50 text-white/90 backdrop-blur-sm"
          aria-live="polite"
        >
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <span className="text-xs font-semibold tracking-[0.4em] text-white/80 uppercase">
            Checking answers
          </span>
        </output>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      <div className="relative flex-1">{stageContent}</div>
    </div>
  );
}
