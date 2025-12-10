import { useCallback, useEffect, useMemo, useRef } from 'react';

import { EncounterModal } from '@/components/encounter/EncounterModal';
import { PokemonDetailModal } from '@/components/pokemon/PokemonDetailModal';
import QueryProvider from '@/components/QueryProvider';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';
import { usePokemonDetailViewModel } from '@/components/pokemon/hooks';

interface PokemonDetailPageProps {
  readonly pokemonId: number;
  readonly fallbackPath?: string;
}

const DEFAULT_FALLBACK = '/dashboard';

export function PokemonDetailPage({
  pokemonId,
  fallbackPath = DEFAULT_FALLBACK,
}: PokemonDetailPageProps) {
  return (
    <QueryProvider>
      <PokemonDetailPageInner pokemonId={pokemonId} fallbackPath={fallbackPath} />
    </QueryProvider>
  );
}

function PokemonDetailPageInner({
  pokemonId,
  fallbackPath = DEFAULT_FALLBACK,
}: PokemonDetailPageProps) {
  const { detail, isLoading, error, refetch } = usePokemonDetailViewModel(pokemonId);
  const hasRedirectedRef = useRef(false);

  const isEncounterOpen = useEncounterStore((state) => state.isOpen);
  const closeEncounter = useEncounterStore((state) => state.actions.closeModal);

  const handleRequestClose = useCallback(() => {
    if (globalThis.window === undefined) {
      return;
    }
    const target = fallbackPath ?? DEFAULT_FALLBACK;
    globalThis.window.location.replace(target);
  }, [fallbackPath]);

  const ownsPokemon = useMemo(() => {
    if (!detail) {
      return undefined;
    }
    const currentEntry = detail.evolutionLine?.evolutions.find((entry) => entry.isCurrent);
    if (currentEntry?.inCollection !== undefined) {
      return currentEntry.inCollection;
    }
    if (detail.captureStatus) {
      if (detail.captureStatus.owned.length > 0) {
        return true;
      }
      return detail.captureStatus.isBaseCaught;
    }
    return undefined;
  }, [detail]);

  useEffect(() => {
    if (hasRedirectedRef.current || globalThis.window === undefined) {
      return;
    }
    if (isLoading || error || !detail) {
      return;
    }
    if (ownsPokemon === undefined) {
      return;
    }
    if (ownsPokemon) {
      return;
    }
    hasRedirectedRef.current = true;
    const target = fallbackPath ?? DEFAULT_FALLBACK;
    globalThis.window.location.replace(target);
  }, [detail, error, fallbackPath, isLoading, ownsPokemon]);

  const shouldShowDetail = ownsPokemon !== false;

  return (
    <>
      {shouldShowDetail ? (
        <PokemonDetailModal
          id={pokemonId}
          isOpen
          onRequestClose={handleRequestClose}
          detail={detail}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
      ) : null}
      <EncounterModal isOpen={isEncounterOpen} onRequestClose={closeEncounter} />
    </>
  );
}
