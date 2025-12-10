import type {
  CollectionStatsDto,
  ErrorResponseDto,
  PokemonDetailDto,
  PokemonTypeDto,
  RecentCaptureDto,
  VariantEnum,
} from '../types';

import type { CSSProperties } from 'react';
import ErrorAlert from './ErrorAlert';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { getTypeIconSrc } from '@/lib/type-icons';
import { usePokemonDetailModal } from '@/components/pokemon/PokemonDetailModalProvider';
import { useQuery } from '@tanstack/react-query';

interface RecentCaptureCardProps {
  readonly pokemonId: number;
  readonly name: string;
  readonly sprite: string;
  readonly capturedAtRelative: string;
  readonly variant: VariantEnum;
}

const shinySparkles: { id: string; emoji: '✨' | '🌟' | '💫'; style: CSSProperties }[] = [
  {
    id: 'sparkle-1',
    emoji: '✨',
    style: { top: '6%', left: '10%', fontSize: '0.9rem', animationDelay: '0s', opacity: 0.18 },
  },
  {
    id: 'sparkle-2',
    emoji: '🌟',
    style: { top: '16%', right: '12%', fontSize: '1.05rem', animationDelay: '0.8s', opacity: 0.2 },
  },
  {
    id: 'sparkle-3',
    emoji: '💫',
    style: { bottom: '14%', left: '14%', fontSize: '1rem', animationDelay: '1.6s', opacity: 0.18 },
  },
  {
    id: 'sparkle-4',
    emoji: '✨',
    style: {
      bottom: '24%',
      right: '20%',
      fontSize: '0.85rem',
      animationDelay: '2.4s',
      opacity: 0.16,
    },
  },
  {
    id: 'sparkle-5',
    emoji: '🌟',
    style: { top: '38%', left: '6%', fontSize: '1rem', animationDelay: '3.2s', opacity: 0.18 },
  },
  {
    id: 'sparkle-6',
    emoji: '💫',
    style: { top: '54%', right: '12%', fontSize: '1.05rem', animationDelay: '4s', opacity: 0.2 },
  },
  {
    id: 'sparkle-7',
    emoji: '✨',
    style: {
      bottom: '8%',
      right: '32%',
      fontSize: '0.8rem',
      animationDelay: '4.6s',
      opacity: 0.16,
    },
  },
  {
    id: 'sparkle-8',
    emoji: '✨',
    style: { top: '26%', left: '32%', fontSize: '0.9rem', animationDelay: '5.2s', opacity: 0.18 },
  },
  {
    id: 'sparkle-9',
    emoji: '🌟',
    style: {
      bottom: '30%',
      left: '26%',
      fontSize: '0.95rem',
      animationDelay: '5.8s',
      opacity: 0.18,
    },
  },
  {
    id: 'sparkle-10',
    emoji: '💫',
    style: { top: '64%', right: '32%', fontSize: '0.9rem', animationDelay: '6.4s', opacity: 0.2 },
  },
  {
    id: 'sparkle-11',
    emoji: '✨',
    style: { top: '46%', right: '6%', fontSize: '0.8rem', animationDelay: '7s', opacity: 0.16 },
  },
  {
    id: 'sparkle-12',
    emoji: '🌟',
    style: {
      bottom: '18%',
      right: '8%',
      fontSize: '0.95rem',
      animationDelay: '7.6s',
      opacity: 0.18,
    },
  },
  {
    id: 'sparkle-13',
    emoji: '💫',
    style: { top: '8%', right: '32%', fontSize: '0.85rem', animationDelay: '8.2s', opacity: 0.18 },
  },
  {
    id: 'sparkle-14',
    emoji: '✨',
    style: {
      bottom: '40%',
      left: '44%',
      fontSize: '0.75rem',
      animationDelay: '8.8s',
      opacity: 0.16,
    },
  },
];

const LOADING_PLACEHOLDERS = ['recent-1', 'recent-2', 'recent-3', 'recent-4', 'recent-5'] as const;

async function fetchPokemonTypes(pokemonId: number): Promise<PokemonTypeDto[]> {
  const response = await fetch(`/api/pokemon/${pokemonId}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch pokemon detail');
  }

  const detail: PokemonDetailDto = await response.json();
  return detail.types ?? [];
}

async function fetchRecentCaptures(): Promise<RecentCaptureDto[]> {
  const response = await fetch('/api/collection/stats', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ErrorResponseDto = await response.json();
    throw new Error(errorData.error.message || 'Failed to fetch recent captures');
  }

  const stats: CollectionStatsDto = await response.json();
  return stats.recentCaptures ?? [];
}

function formatRelativeTime(capturedAt: string): string {
  const now = new Date();
  const capturedDate = new Date(capturedAt);
  const diffMs = now.getTime() - capturedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return capturedDate.toLocaleDateString();
}

function RecentCaptureCardSkeleton() {
  return (
    <div
      className="relative flex min-h-[250px] flex-col items-center overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 p-4"
      aria-busy="true"
      aria-label="Loading recent capture card"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/30 via-slate-900/50 to-slate-950/80" />
      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="flex gap-2">
            <div className="h-6 w-12 rounded-full bg-white/10" />
            <div className="h-6 w-16 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="mt-6 flex flex-1 flex-col items-center gap-4">
          <div className="h-24 w-24 rounded-full bg-white/5" />
          <div className="flex flex-col items-center gap-2">
            <div className="h-4 w-24 rounded-full bg-white/10" />
            <div className="h-3 w-16 rounded-full bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentCaptureCard({
  pokemonId,
  name,
  sprite,
  capturedAtRelative,
  variant,
}: RecentCaptureCardProps) {
  const { open: openPokemonDetail } = usePokemonDetailModal();
  const {
    data: types = [],
    isPending: areTypesPending,
    isFetching: areTypesFetching,
    isError: hasTypeError,
  } = useQuery<PokemonTypeDto[]>({
    queryKey: ['pokemon-types', pokemonId],
    queryFn: () => fetchPokemonTypes(pokemonId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: pokemonId > 0,
  });

  const hasTypes = types.length > 0;
  const typesLoading = areTypesPending || areTypesFetching;
  const canShowCard = hasTypes || hasTypeError || !typesLoading;

  if (canShowCard) {
    const handleClick = () => {
      openPokemonDetail(pokemonId);
    };

    const sortedTypes = [...types].sort((a, b) => a.slot - b.slot);
    const formattedNumber = pokemonId > 0 ? `#${pokemonId.toString().padStart(3, '0')}` : '-';
    const showShinyBadge = variant === 'shiny';

    return (
      <button
        onClick={handleClick}
        className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/20 bg-slate-950/90 p-4 text-left transition-all duration-200 hover:border-cyan-300/60 hover:shadow-lg hover:shadow-cyan-500/40"
      >
        {showShinyBadge ? (
          <span className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl">
            <span className="absolute inset-0 bg-gradient-to-br from-yellow-400/12 via-transparent to-cyan-300/12" />
            <span className="absolute inset-0">
              {shinySparkles.map((sparkle) => (
                <span
                  key={sparkle.id}
                  className="floating-emoji absolute"
                  style={sparkle.style}
                  aria-hidden="true"
                >
                  {sparkle.emoji}
                </span>
              ))}
            </span>
          </span>
        ) : null}
        <TypeWaveBackground types={types} variant="card" className="opacity-90" />
        <div className="absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
          <span className="inline-flex h-6 items-center rounded-full border border-white/50 px-2 font-mono text-[11px] text-white/90 shadow shadow-black/30">
            {formattedNumber}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {showShinyBadge ? (
              <span className="relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-yellow-300/70 bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-50 shadow ring-1 shadow-yellow-500/40 ring-yellow-400/50">
                <span
                  className="pointer-events-none absolute inset-[-2px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)]"
                  aria-hidden="true"
                />
                ✨ Shiny
              </span>
            ) : null}
            {sortedTypes.length > 0 && (
              <div className="inline-flex h-6 items-center gap-1 overflow-hidden rounded-full border border-white/80 bg-slate-900/60 px-2 text-white shadow shadow-black/30">
                {sortedTypes.map((type) => {
                  const iconSrc = getTypeIconSrc(type.name);
                  const fallbackLabel = type.name.slice(0, 1).toUpperCase();
                  const key = `${pokemonId}-${type.id}-${type.slot}`;
                  return iconSrc ? (
                    <img
                      key={key}
                      src={iconSrc}
                      alt={`${type.name} type icon`}
                      className="h-3.5 w-3.5 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span
                      key={key}
                      className="flex h-3.5 w-3.5 items-center justify-center text-[9px] font-semibold text-slate-900 uppercase"
                    >
                      {fallbackLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="relative z-20 mt-6 flex w-full flex-col items-center gap-3 text-slate-100">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {showShinyBadge ? (
              <span
                className="bg-[radial-gradient(circle_at_50%_50%,rgba(253,224,71,0.18),rgba(59,130,246,0.12) 55%,transparent_72%)] pointer-events-none absolute inset-[-10%] rounded-full blur-[2px]"
                aria-hidden="true"
              />
            ) : null}
            <img
              src={sprite}
              alt={name}
              className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(34,211,238,0.45)] transition-transform duration-200 group-hover:scale-110"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-lg font-semibold text-white capitalize">{name}</h3>
            <p className="text-xs tracking-[0.3em] text-white/70 uppercase">{capturedAtRelative}</p>
          </div>
        </div>
      </button>
    );
  }

  return <RecentCaptureCardSkeleton />;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {LOADING_PLACEHOLDERS.map((placeholderId) => (
        <div key={placeholderId} className="h-40 animate-pulse rounded-lg bg-slate-950/90" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-700/80 bg-slate-950/90 px-4 py-12 text-center">
      <div className="mb-4 text-6xl">🎯</div>
      <h3 className="mb-2 text-xl font-semibold text-slate-100">No captures yet</h3>
      <p className="mb-6 text-slate-400">Start your journey by catching your first Pokémon!</p>
    </div>
  );
}

export default function RecentCaptures() {
  const { data, isLoading, error, refetch } = useQuery<RecentCaptureDto[]>({
    // Use a distinct query key to avoid cache shape conflicts with DashboardStats
    queryKey: ['collection', 'recentCaptures'],
    queryFn: fetchRecentCaptures,
    staleTime: 60 * 1000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Recent Captures</h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Recent Captures</h3>
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Failed to load recent captures'}
          title="Recent captures unavailable"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const recentCaptures = Array.isArray(data) ? data : [];
  const displayCaptures = recentCaptures.slice(0, 5);

  if (displayCaptures.length === 0) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Recent Captures</h3>
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Recent Captures</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {displayCaptures.map((capture) => (
          <RecentCaptureCard
            key={`${capture.pokemonId}-${capture.capturedAt}`}
            pokemonId={capture.pokemonId}
            name={capture.name}
            sprite={capture.sprite}
            capturedAtRelative={formatRelativeTime(capture.capturedAt)}
            variant={capture.variant}
          />
        ))}
      </div>
    </div>
  );
}
