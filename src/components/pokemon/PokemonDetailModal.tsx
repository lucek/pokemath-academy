import type { EncounterResponseDto, PokemonDetailDto, VariantEnum } from '@/types';
import {
  PokemonModalHeaderProvider,
  createDetailModalHeaderConfig,
} from '@/components/pokemon/PokemonModalHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BasePokemonModal } from '@/components/pokemon/BasePokemonModal';
import { Button } from '@/components/ui/button';
import { EvolutionChain } from '@/components/pokemon/EvolutionChain';
import { PokemonDetailSkeleton } from '@/components/pokemon/PokemonDetailSkeleton';
import type { PokemonDetailViewModel } from '@/components/pokemon/types';
import type { ResultViewModel } from '@/components/encounter/types';
import { StatsBars } from '@/components/pokemon/StatsBars';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';
import { useQueryClient } from '@tanstack/react-query';

interface PokemonDetailModalProps {
  readonly id: number;
  readonly isOpen: boolean;
  readonly onRequestClose: () => void;
  readonly detail?: PokemonDetailViewModel;
  readonly isLoading?: boolean;
  readonly error?: Error;
  readonly onRetry?: () => void;
  readonly onSelectEvolution?: (id: number) => void;
}

export function PokemonDetailModal({
  id,
  isOpen,
  onRequestClose,
  detail,
  isLoading = false,
  error,
  onRetry,
  onSelectEvolution,
}: PokemonDetailModalProps) {
  const startEvolutionEncounter = useEncounterStore(
    (state) => state.actions.startEvolutionEncounter,
  );
  const encounterType = useEncounterStore((state) => state.encounterType);
  const lastResult = useEncounterStore((state) => state.lastResult);
  const originPokemonId = useEncounterStore((state) => state.originPokemonId);
  const handledResultRef = useRef<ResultViewModel | undefined>(undefined);
  const queryClient = useQueryClient();
  const ownedVariants = useMemo(
    () => detail?.captureStatus?.owned ?? [],
    [detail?.captureStatus?.owned],
  );
  const hasRecentShinyCapture =
    lastResult?.kind === 'success' &&
    lastResult.pokemon.variant === 'shiny' &&
    lastResult.pokemon.id === id;
  const shinyUnlocked =
    hasRecentShinyCapture || ownedVariants.some((entry) => entry.variant === 'shiny');
  const normalOwned = ownedVariants.some((entry) => entry.variant === 'normal');
  const [variantView, setVariantView] = useState<VariantEnum>('normal');

  const handleVariantChange = useCallback((next: VariantEnum) => {
    setVariantView((current) => (current === next ? current : next));
  }, []);

  const headerConfig = useMemo(
    () =>
      createDetailModalHeaderConfig({
        id,
        detail,
        isLoading,
        variant: variantView,
        onVariantChange: handleVariantChange,
        forceShinyUnlocked: shinyUnlocked,
      }),
    [detail, handleVariantChange, id, isLoading, shinyUnlocked, variantView],
  );

  const handleSelectEvolution = useCallback(
    (nextId: number) => {
      if (!Number.isFinite(nextId)) return;
      if (onSelectEvolution) {
        onSelectEvolution(nextId);
        return;
      }
      const win = globalThis.window;
      if (win) {
        win.location.assign(`/pokemon/${nextId}`);
      }
    },
    [onSelectEvolution],
  );

  const handleOpenEncounter = useCallback(
    (response: EncounterResponseDto) => {
      startEvolutionEncounter(response, { originPokemonId: id });
    },
    [id, startEvolutionEncounter],
  );

  useEffect(() => {
    handleVariantChange('normal');
  }, [handleVariantChange, id]);

  useEffect(() => {
    if (!shinyUnlocked) {
      return;
    }
    if (!normalOwned) {
      handleVariantChange('shiny');
    }
  }, [handleVariantChange, normalOwned, shinyUnlocked]);

  useEffect(() => {
    if (!shinyUnlocked && variantView === 'shiny') {
      handleVariantChange('normal');
    }
  }, [handleVariantChange, shinyUnlocked, variantView]);

  useEffect(() => {
    const detailId = id > 0 ? id : originPokemonId;
    if (!detailId) {
      return;
    }
    if (encounterType !== 'evolution') {
      return;
    }
    const result = lastResult;
    if (result?.kind !== 'success') {
      return;
    }
    if (handledResultRef.current === result) {
      return;
    }
    handledResultRef.current = result;
    onRetry?.();
    queryClient.setQueryData<PokemonDetailDto>(['pokemon-detail', detailId], (current) => {
      if (!current?.evolution_line) {
        return current;
      }
      const capturedId = result.pokemon.id;
      const nextEvolutions = current.evolution_line.evolutions.map((entry) => {
        if (entry.id !== capturedId) {
          return entry;
        }
        return {
          ...entry,
          in_collection: true,
          can_evolve: false,
        };
      });

      const nextLine = {
        ...current.evolution_line,
        evolutions: nextEvolutions,
      };

      return {
        ...current,
        evolution_line: nextLine,
      };
    });

    queryClient
      .invalidateQueries({ queryKey: ['pokemon-detail', detailId] })
      .catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ['pokemon-detail'] }).catch(() => undefined);
  }, [encounterType, id, originPokemonId, lastResult, onRetry, queryClient]);

  const bottomContent = (
    <PokemonDetailBottomContent
      detail={detail}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      onBack={onRequestClose}
      onSelectEvolution={handleSelectEvolution}
      onOpenEncounter={handleOpenEncounter}
      selectedVariant={variantView}
      isShinyUnlocked={shinyUnlocked}
      onVariantChange={handleVariantChange}
    />
  );

  return (
    <PokemonModalHeaderProvider value={headerConfig}>
      <BasePokemonModal isOpen={isOpen} onClose={onRequestClose} bottomContent={bottomContent} />
    </PokemonModalHeaderProvider>
  );
}

interface PokemonDetailBottomContentProps {
  readonly detail?: PokemonDetailViewModel;
  readonly isLoading: boolean;
  readonly error?: Error;
  readonly onRetry?: () => void;
  readonly onBack: () => void;
  readonly onSelectEvolution: (id: number) => void;
  readonly onOpenEncounter: (response: EncounterResponseDto) => void;
  readonly onVariantChange: (variant: VariantEnum) => void;
}

function PokemonDetailBottomContent({
  detail,
  isLoading,
  error,
  onRetry,
  onBack,
  onSelectEvolution,
  onOpenEncounter,
}: PokemonDetailBottomContentProps) {
  if (isLoading) {
    return <PokemonDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Failed to load Pokémon detail.</p>
          <p className="mt-1 text-sm text-white/70">{error.message}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <Button
              variant="outline"
              onClick={onRetry}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              Retry load
            </Button>
          ) : null}
          <Button onClick={onBack} className="bg-white text-[#070a16] hover:bg-white/90">
            Back to collection
          </Button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-white/70">
        <p>No Pokémon data available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <div className="w-full md:w-[38%]">
          <StatsBars stats={detail.stats} />
        </div>
        <div className="w-full md:w-[62%]">
          <EvolutionChain
            line={detail.evolutionLine}
            onSelectEvolution={onSelectEvolution}
            onOpenEncounter={onOpenEncounter}
          />
        </div>
      </div>
    </div>
  );
}
