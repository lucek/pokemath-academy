import type { EncounterPokemonViewModel, ResultViewModel } from '@/components/encounter/types';
import { buildWavePalette, rgbaFromHex } from '@/lib/type-colors';
import { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResultScreenProps {
  readonly result: ResultViewModel;
  readonly onRetry: () => void;
  readonly onNewEncounter: () => void;
  readonly onClose: () => void;
  readonly onViewPokemon?: (pokemonId: number) => void;
  readonly pokemon?: EncounterPokemonViewModel;
  readonly attemptsRemaining: number;
}

export function ResultScreen({
  result,
  onRetry,
  onNewEncounter,
  onClose,
  onViewPokemon,
  pokemon,
  attemptsRemaining,
}: ResultScreenProps) {
  const isSuccess = result.kind === 'success';
  const isFailure = result.kind === 'failure';
  const palette = useMemo(() => buildWavePalette(pokemon?.types ?? []), [pokemon?.types]);
  const attemptsLeft = Math.max(0, attemptsRemaining);
  const canRetry = isFailure && result.canRetry && attemptsLeft > 0;
  const retriesExhausted = isFailure && !canRetry;
  const statusLabel = isSuccess ? 'SUCCESS' : 'FAILURE';
  const subtitle = isFailure && retriesExhausted ? 'Pokemon fled.' : result.message;
  const accentBorder = rgbaFromHex(palette.accent, 0.4);
  const buttonBaseClass =
    'h-10 min-w-[150px] rounded-2xl px-5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] shadow transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/30';
  const primaryButtonStyle = {
    borderColor: accentBorder,
    backgroundColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 15px 30px rgba(0,0,0,0.35)',
  };
  const outlineButtonStyle = {
    borderColor: accentBorder,
    boxShadow: '0 10px 24px rgba(0,0,0,0.3)',
  };

  const handleSeeCollection = useCallback(() => {
    if (result.kind !== 'success' || !onViewPokemon) {
      return;
    }
    onViewPokemon(result.pokemon.id);
  }, [onViewPokemon, result]);

  const renderSuccessActions = () => (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
      {onViewPokemon ? (
        <Button
          size="sm"
          onClick={handleSeeCollection}
          data-test-id="encounter-view-pokemon"
          className={cn(buttonBaseClass, 'border border-white/10 text-white')}
          style={primaryButtonStyle}
        >
          See Pokemon
        </Button>
      ) : null}
      <Button
        size="sm"
        onClick={onNewEncounter}
        data-test-id="encounter-new"
        className={cn(buttonBaseClass, 'border border-white/10 text-white')}
        style={primaryButtonStyle}
      >
        New Encounter
      </Button>
      <Button
        size="sm"
        onClick={onClose}
        data-test-id="encounter-flee"
        className={cn(buttonBaseClass, 'border border-white/10 text-white')}
        style={primaryButtonStyle}
      >
        Flee
      </Button>
    </div>
  );

  const renderFailureActions = () => {
    if (canRetry) {
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <Button
            size="sm"
            onClick={onRetry}
            data-test-id="encounter-retry"
            className={cn(buttonBaseClass, 'border border-white/10 text-white')}
            style={primaryButtonStyle}
          >
            Retry
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            data-test-id="encounter-flee"
            className={cn(buttonBaseClass, 'border border-white/10 text-white')}
            style={primaryButtonStyle}
          >
            Flee
          </Button>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
        <Button
          size="sm"
          onClick={onNewEncounter}
          data-test-id="encounter-new"
          className={cn(buttonBaseClass, 'border border-white/10 text-white')}
          style={primaryButtonStyle}
        >
          New Encounter
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          data-test-id="encounter-flee"
          className={cn(buttonBaseClass, 'border border-white/25 text-white hover:bg-white/10')}
          style={outlineButtonStyle}
        >
          Flee
        </Button>
      </div>
    );
  };

  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-6 px-4 py-6 text-white sm:px-8 sm:py-8"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.35em] text-white/50 uppercase">
          Encounter status
        </p>
        <h2
          className="mt-2 text-4xl font-bold tracking-[0.5em] uppercase sm:text-5xl"
          data-test-id="encounter-status"
        >
          {statusLabel}
        </h2>
        {subtitle ? <p className="mt-3 text-sm text-white/80">{subtitle}</p> : null}
      </div>
      {isFailure ? (
        <div className="flex flex-col items-center gap-2 text-xs tracking-[0.3em] text-white/70 uppercase">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-semibold"
            data-test-id="encounter-retries-remaining"
            style={{
              borderColor: accentBorder,
              backgroundColor: rgbaFromHex(palette.accent, 0.12),
              boxShadow: `0 8px 20px rgba(0, 0, 0, 0.35)`,
            }}
          >
            {attemptsLeft} {attemptsLeft === 1 ? 'retry' : 'retries'} left
          </span>
        </div>
      ) : null}
      {isSuccess ? renderSuccessActions() : renderFailureActions()}
    </div>
  );
}
