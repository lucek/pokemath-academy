import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CollectionGridItemVm, CollectionViewStatus } from './types';
import { PokemonCard } from './PokemonCard';
import { SkeletonCard } from './SkeletonCard';
import { EmptyState } from './EmptyState';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';

interface CollectionGridProps {
  readonly items: CollectionGridItemVm[];
  readonly status: CollectionViewStatus;
  readonly hasMore: boolean;
  readonly isFetchingMore: boolean;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onCardClick: (pokemonId: number) => void;
  readonly onClearFilters: () => void;
}

export function CollectionGrid({
  items,
  status,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onRetry,
  onCardClick,
  onClearFilters,
}: CollectionGridProps) {
  if (status.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-12 text-center text-red-100">
        <AlertTriangle className="size-8" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold">Failed to load your collection</p>
          <p className="text-sm opacity-80">{status.message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-red-400/50 text-red-100"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (status.status === 'loading' && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCard key={`skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (status.status === 'success' && items.length === 0) {
    return <EmptyState onClearFilters={onClearFilters} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <PokemonCard
            key={`${item.pokemonId}-${item.badges.shiny ? 'shiny' : 'normal'}`}
            item={item}
            onClick={onCardClick}
          />
        ))}
        {status.status === 'loading' &&
          items.length > 0 &&
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={`append-skeleton-${index}`} />
          ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        {status.status === 'success' && hasMore && (
          <>
            <InfiniteScrollSentinel active={hasMore && !isFetchingMore} onIntersect={onLoadMore} />
            <p className="text-xs tracking-[0.3em] text-slate-400 uppercase">Scroll to load more</p>
          </>
        )}

        {isFetchingMore && (
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="size-4 animate-spin text-cyan-300" aria-hidden="true" />
            Loading more Pokémon…
          </p>
        )}

        {!hasMore && status.status === 'success' && (
          <p className="text-xs tracking-[0.3em] text-slate-500 uppercase">You reached the end</p>
        )}
      </div>
    </div>
  );
}
