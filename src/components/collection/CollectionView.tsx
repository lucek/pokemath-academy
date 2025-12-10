import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import {
  PokemonDetailModalProvider,
  usePokemonDetailModal,
} from '@/components/pokemon/PokemonDetailModalProvider';

import { Button } from '@/components/ui/button';
import { CollectionFilters } from './CollectionFilters';
import type { CollectionFiltersState } from './types';
import { CollectionGrid } from './CollectionGrid';
import QueryProvider from '@/components/QueryProvider';
import { useCollectionFilters } from './hooks/useCollectionFilters';
import { useCollectionQuery } from './hooks/useCollectionQuery';
import { useCollectionStats } from './hooks/useCollectionStats';
import TypeProgressGrid from '../TypeProgressGrid';
import { cn } from '@/lib/utils';
import { EncounterModal } from '@/components/encounter/EncounterModal';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';
import type { ResultViewModel } from '@/components/encounter/types';

interface CollectionViewProps {
  readonly initialFilters: CollectionFiltersState;
}

export default function CollectionView({ initialFilters }: CollectionViewProps) {
  const isEncounterOpen = useEncounterStore((state) => state.isOpen);
  const closeEncounter = useEncounterStore((state) => state.actions.closeModal);

  return (
    <QueryProvider>
      <PokemonDetailModalProvider>
        <CollectionViewShell initialFilters={initialFilters} />
        <EncounterModal isOpen={isEncounterOpen} onRequestClose={closeEncounter} />
      </PokemonDetailModalProvider>
    </QueryProvider>
  );
}

function CollectionViewShell({ initialFilters }: CollectionViewProps) {
  const { filters, setFilters, resetFilters } = useCollectionFilters(initialFilters);
  const remoteFilters = useMemo(
    () => ({
      ...filters,
      typeId: null,
      caught: 'all' as const,
      variant: 'all' as const,
    }),
    [filters],
  );
  const collectionQuery = useCollectionQuery(remoteFilters);
  const statsQuery = useCollectionStats();
  const encounterLastResult = useEncounterStore((state) => state.lastResult);
  const encounterType = useEncounterStore((state) => state.encounterType);
  const { open: openPokemonDetail } = usePokemonDetailModal();

  const busy = collectionQuery.status.status === 'loading';
  const filteredItems = useMemo(() => {
    return collectionQuery.items.filter((item) => {
      if (filters.typeId && !item.types.some((type) => type.id === filters.typeId)) {
        return false;
      }

      if (filters.caught === 'caught' && !item.isCaught) {
        return false;
      }

      if (filters.caught === 'uncaught' && item.isCaught) {
        return false;
      }

      if (filters.variant === 'shiny' && !item.isShiny) {
        return false;
      }

      if (filters.variant === 'normal' && item.isShiny) {
        return false;
      }

      return true;
    });
  }, [collectionQuery.items, filters.caught, filters.typeId, filters.variant]);
  const showTopSections = false;

  const handleFiltersChange = useCallback(
    (update: Partial<CollectionFiltersState>) => {
      setFilters(update);
    },
    [setFilters],
  );

  const handledResultRef = useRef<ResultViewModel | undefined>(undefined);
  const collectionRefetch = collectionQuery.refetch;
  const statsRefetch = statsQuery.refetch;

  useEffect(() => {
    if (encounterType !== 'evolution') {
      return;
    }
    const result = encounterLastResult;
    if (result?.kind !== 'success') {
      return;
    }
    if (handledResultRef.current === result) {
      return;
    }
    handledResultRef.current = result;
    collectionRefetch();
    statsRefetch();
  }, [collectionRefetch, encounterLastResult, encounterType, statsRefetch]);

  return (
    <section className="space-y-8" aria-live="polite">
      {showTopSections && (
        <>
          <header className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-cyan-500/10">
            <div>
              <p className="text-xs tracking-[0.4em] text-cyan-300/80 uppercase">My Collection</p>
              <h1 className="text-3xl font-semibold text-white">Gen 1 Pokédex tracker</h1>
              <p className="text-sm text-slate-300">
                <span>Filter, search, and review every Pokémon you have captured so far.</span>{' '}
                <span>Infinite scroll, shiny tracking, and modal details arrive next.</span>
              </p>
            </div>
            <StatsSummary statsHook={statsQuery} />
          </header>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg shadow-black/40">
            <CollectionFilters
              value={filters}
              busy={busy}
              onChange={handleFiltersChange}
              onReset={resetFilters}
            />
          </div>

          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-8 text-center text-slate-300">
            <CollectionStatusPreview
              status={collectionQuery.status}
              itemCount={filteredItems.length}
              onRetry={collectionQuery.refetch}
              isFetchingMore={collectionQuery.isFetchingMore}
            />
          </div>
        </>
      )}

      <TypeFilterSection
        statsHook={statsQuery}
        selectedTypeId={filters.typeId}
        caughtFilter={filters.caught}
        variantFilter={filters.variant}
        onSelectType={(typeId) => handleFiltersChange({ typeId })}
        onCaughtChange={(caught) => handleFiltersChange({ caught })}
        onVariantChange={(variant) => handleFiltersChange({ variant })}
      />

      <CollectionGrid
        items={filteredItems}
        status={collectionQuery.status}
        hasMore={collectionQuery.pagination.hasMore}
        isFetchingMore={collectionQuery.isFetchingMore}
        onLoadMore={collectionQuery.loadMore}
        onRetry={collectionQuery.refetch}
        onCardClick={openPokemonDetail}
        onClearFilters={resetFilters}
      />
    </section>
  );
}

interface StatsSummaryProps {
  readonly statsHook: ReturnType<typeof useCollectionStats>;
}

function StatsSummary({ statsHook }: StatsSummaryProps) {
  if (statsHook.status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (statsHook.status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <p>{statsHook.error?.message ?? 'Failed to load collection stats.'}</p>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/40 text-red-100"
          onClick={() => statsHook.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!statsHook.stats) {
    return null;
  }

  const { totalCaptured, totalPossible, shinyCount, completionPercent } = statsHook.stats;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <p className="text-xs tracking-[0.3em] text-cyan-300/80 uppercase">Completion</p>
        <div className="mt-2 text-3xl font-semibold text-white">
          {completionPercent.toFixed(2)}%
        </div>
        <p className="text-sm text-slate-400">
          {totalCaptured} / {totalPossible} captured
        </p>
      </div>
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
        <p className="text-xs tracking-[0.3em] text-yellow-200/80 uppercase">Shiny</p>
        <div className="mt-2 text-3xl font-semibold text-white">{shinyCount}</div>
        <p className="text-sm text-yellow-100/80">Shiny variants secured</p>
      </div>
    </div>
  );
}

interface CollectionStatusPreviewProps {
  readonly status: ReturnType<typeof useCollectionQuery>['status'];
  readonly itemCount: number;
  readonly isFetchingMore: boolean;
  readonly onRetry: () => void;
}

function CollectionStatusPreview({
  status,
  itemCount,
  onRetry,
  isFetchingMore,
}: CollectionStatusPreviewProps) {
  if (status.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-cyan-300" aria-hidden="true" />
        <p className="text-sm text-slate-300">Loading collection items…</p>
      </div>
    );
  }

  if (status.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 text-red-100">
        <AlertTriangle className="size-6" aria-hidden="true" />
        <p className="text-sm">{status.message}</p>
        <Button
          type="button"
          variant="outline"
          className="border-red-400/60 text-red-100"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (status.status === 'success') {
    return (
      <div className="space-y-2">
        <p className="text-lg font-semibold text-white">Collection data ready</p>
        <p className="text-sm text-slate-300">
          {itemCount} entries loaded. Infinite grid, skeleton cards, and scroll sentinel will render
          next.
        </p>
        {isFetchingMore && (
          <p className="text-xs text-slate-400">
            Loading additional pages…{' '}
            <Loader2 className="inline size-3 animate-spin text-cyan-300" aria-hidden="true" />
          </p>
        )}
      </div>
    );
  }

  return <p className="text-sm text-slate-400">Awaiting filter selection…</p>;
}

interface TypeFilterSectionProps {
  readonly statsHook: ReturnType<typeof useCollectionStats>;
  readonly selectedTypeId: number | null;
  readonly caughtFilter: CollectionFiltersState['caught'];
  readonly variantFilter: CollectionFiltersState['variant'];
  readonly onSelectType: (typeId: number | null) => void;
  readonly onCaughtChange: (caught: CollectionFiltersState['caught']) => void;
  readonly onVariantChange: (variant: CollectionFiltersState['variant']) => void;
}

function TypeFilterSection({
  statsHook,
  selectedTypeId,
  caughtFilter,
  variantFilter,
  onSelectType,
  onCaughtChange,
  onVariantChange,
}: TypeFilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLoading = statsHook.status === 'loading' || statsHook.status === 'idle';
  const hasError = statsHook.status === 'error';
  const breakdown = statsHook.stats?.typeBreakdown ?? [];
  const containerClass =
    'relative overflow-hidden rounded-3xl border border-white/10 shadow-lg shadow-cyan-500/10';
  const containerStyle = {
    background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))',
  } as const;

  const captureOptions: CollectionFiltersState['caught'][] = ['all', 'caught'];
  const variantOptions: CollectionFiltersState['variant'][] = ['normal', 'shiny'];

  const gridContent = (() => {
    if (isLoading) {
      return (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9"
          aria-live="polite"
        >
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={`type-filter-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-white/5 opacity-70"
            />
          ))}
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/20 p-4 text-sm text-red-50">
          <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />
          <div className="space-y-1">
            <p>We couldn&apos;t load your type progress.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-200/70 text-red-50 hover:bg-red-500/20"
              onClick={() => statsHook.refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <TypeProgressGrid
        breakdown={breakdown}
        selectedTypeId={selectedTypeId}
        onTypeSelect={onSelectType}
      />
    );
  })();

  return (
    <section className={containerClass} style={containerStyle}>
      <button
        type="button"
        data-test-id="collection-filters-toggle"
        className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold tracking-[0.3em] text-slate-200 uppercase transition hover:bg-white/5"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span>Collection filters</span>
        <ChevronDown
          className={cn('size-4 transition-transform', isExpanded ? 'rotate-180' : 'rotate-0')}
          aria-hidden="true"
        />
      </button>
      {!isExpanded ? null : (
        <div className="relative space-y-5 border-t border-white/10 p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs tracking-[0.35em] text-cyan-200/80 uppercase">Captured</p>
              <p className="mt-1 text-sm text-slate-300">
                Switch between your full Pokédex and caught-only view.
              </p>
              <div className="mt-3 inline-flex rounded-full bg-slate-900/80 p-1">
                {captureOptions.map((option) => {
                  const isActive = caughtFilter === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onCaughtChange(option)}
                      className={cn(
                        'rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition',
                        isActive
                          ? 'bg-white text-slate-900 shadow'
                          : 'text-slate-300 hover:text-white',
                      )}
                    >
                      {option === 'all' ? 'All' : 'Caught'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs tracking-[0.35em] text-cyan-200/80 uppercase">Variants</p>
              <p className="mt-1 text-sm text-slate-300">
                Highlight normal or shiny catches. Tap again to reset.
              </p>
              <div className="mt-3 inline-flex rounded-full bg-slate-900/80 p-1">
                {variantOptions.map((option) => {
                  const isActive = variantFilter === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onVariantChange(isActive ? 'all' : option)}
                      data-test-id={`variant-filter-${option}`}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition',
                        isActive
                          ? 'bg-white text-slate-900 shadow'
                          : 'text-slate-300 hover:text-white',
                      )}
                    >
                      {option === 'shiny' ? <Sparkles className="size-3" /> : null}
                      {option === 'shiny' ? 'Shiny' : 'Normal'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {gridContent}
        </div>
      )}
    </section>
  );
}
