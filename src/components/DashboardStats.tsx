import type { CSSProperties } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import forestBackground from '@/assets/backgrounds/forest_background.jpg?url';
import pokemonTotalBackground from '@/assets/backgrounds/pokemon_total_background.jpg?url';
import pokeballSprite from '@/assets/icons/pokeball.png?url';
import type { CollectionStatsDto, ErrorResponseDto, TypeBreakdownDto } from '../types';
import ErrorAlert from './ErrorAlert';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';

interface DashboardStatsViewModel {
  totalCaptured: number;
  totalPossible: number;
  shinyCount: number;
  percentage: number;
  typeBreakdown: TypeBreakdownDto[];
}

async function fetchCollectionStats(): Promise<DashboardStatsViewModel> {
  const response = await fetch('/api/collection/stats', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ErrorResponseDto = await response.json();
    throw new Error(errorData.error.message || 'Failed to fetch collection stats');
  }

  const data: CollectionStatsDto = await response.json();

  return {
    totalCaptured: data.totalCaptured || 0,
    totalPossible: data.totalPossible || 151,
    shinyCount: data.shinyCount || 0,
    percentage: data.percentage || 0,
    typeBreakdown: data.typeBreakdown || [],
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['collection', 'stats'],
    queryFn: fetchCollectionStats,
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });
}

interface SparkleConfig {
  id: string;
  emoji: '✨' | '🌟' | '💫';
  style: CSSProperties;
}

const sparkleEmojis: SparkleConfig[] = [
  {
    id: 'sparkle-1',
    emoji: '✨',
    style: {
      top: '6%',
      left: '12%',
      fontSize: '1.6rem',
      animationDelay: '0s',
      animationDuration: '12s',
      opacity: 0.55,
    },
  },
  {
    id: 'sparkle-2',
    emoji: '🌟',
    style: {
      top: '18%',
      right: '12%',
      fontSize: '2.4rem',
      animationDelay: '1.5s',
      animationDuration: '13s',
      opacity: 0.65,
    },
  },
  {
    id: 'sparkle-3',
    emoji: '💫',
    style: {
      bottom: '10%',
      left: '16%',
      fontSize: '2rem',
      animationDelay: '3s',
      animationDuration: '11s',
      opacity: 0.5,
    },
  },
  {
    id: 'sparkle-4',
    emoji: '✨',
    style: {
      bottom: '20%',
      right: '18%',
      fontSize: '1.35rem',
      animationDelay: '4.5s',
      animationDuration: '10s',
      opacity: 0.6,
    },
  },
  {
    id: 'sparkle-5',
    emoji: '🌟',
    style: {
      top: '40%',
      left: '8%',
      fontSize: '1.9rem',
      animationDelay: '2.25s',
      animationDuration: '14s',
      opacity: 0.45,
    },
  },
  {
    id: 'sparkle-6',
    emoji: '💫',
    style: {
      top: '55%',
      right: '6%',
      fontSize: '2.6rem',
      animationDelay: '5.75s',
      animationDuration: '15s',
      opacity: 0.5,
    },
  },
  {
    id: 'sparkle-7',
    emoji: '✨',
    style: {
      bottom: '8%',
      right: '32%',
      fontSize: '1.1rem',
      animationDelay: '6.2s',
      animationDuration: '9s',
      opacity: 0.7,
    },
  },
  {
    id: 'sparkle-8',
    emoji: '💫',
    style: {
      top: '32%',
      left: '38%',
      fontSize: '1.4rem',
      animationDelay: '7.4s',
      animationDuration: '13.5s',
      opacity: 0.55,
    },
  },
];

function StatCard({
  label,
  value,
  highlight = false,
  backgroundImage,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  backgroundImage?: string;
}) {
  const baseClasses =
    'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-2 p-6 shadow-md backdrop-blur-md';
  const cardTone = highlight
    ? 'bg-[#f6c343]/40 border-[#f9d976]/60 shadow-[0_12px_28px_rgba(245,184,27,0.35)]'
    : 'bg-slate-900/90 border-slate-700/80 shadow-slate-900/40';
  const valueTone = highlight
    ? 'text-white drop-shadow-[0_6px_18px_rgba(15,23,42,0.45)]'
    : 'text-slate-50';
  const labelTone = highlight ? 'text-white/85' : 'text-slate-200';
  const imageStyle = backgroundImage
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(15,23,42,0.92), rgba(15,23,42,0.55)), url('${backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className={`${baseClasses} ${cardTone}`} style={imageStyle}>
      {highlight && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fef3c7]/35 via-[#f6c343]/25 to-[#f4a623]/20"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {sparkleEmojis.map((sparkle) => (
              <span key={sparkle.id} className="floating-emoji absolute" style={sparkle.style}>
                {sparkle.emoji}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="relative z-10 flex flex-col items-center">
        <div className={`mb-2 text-4xl font-bold ${valueTone}`}>{value}</div>
        <div className={`text-sm tracking-wide uppercase ${labelTone}`}>{label}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="h-32 animate-pulse rounded-lg bg-slate-900/90" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-900/90" />
    </div>
  );
}

interface DashboardStatsProps {
  statsQuery?: UseQueryResult<DashboardStatsViewModel, Error>;
}

export default function DashboardStats({ statsQuery }: DashboardStatsProps = {}) {
  const fallbackQuery = useDashboardStats();
  const { data, isLoading, error, refetch } = statsQuery ?? fallbackQuery;

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-semibold text-slate-100">Collection Progress</h2>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-semibold text-slate-100">Collection Progress</h2>
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Failed to load statistics'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold text-slate-100">Collection Progress</h2>
      {data.percentage > 0 && (
        <div className="mb-6">
          <div className="h-3 w-full rounded-full bg-slate-800">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 transition-all duration-500"
              style={{ width: `${Math.min(100, data.percentage)}%` }}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <StartEncounterCard />
        <div className="grid gap-6">
          <StatCard
            label="Pokémon Caught"
            value={`${data.totalCaptured} / ${data.totalPossible}`}
            highlight={false}
            backgroundImage={pokemonTotalBackground}
          />
          <StatCard label="Shiny Caught" value={data.shinyCount} highlight={true} />
        </div>
      </div>
    </div>
  );
}

function StartEncounterCard() {
  const startEncounter = useEncounterStore((state) => state.actions.startWildEncounter);

  return (
    <button
      type="button"
      data-test-id="start-encounter"
      onClick={() => {
        void startEncounter();
      }}
      className="group relative flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/40 p-6 text-left text-slate-50 shadow-[0_12px_32px_rgba(15,23,42,0.45)] transition hover:scale-[1.01] hover:border-emerald-200/60 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.95), rgba(16,185,129,0.75)), url('${forestBackground}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="rounded-full border border-emerald-100/40 bg-emerald-500/20 p-3 shadow-lg shadow-emerald-900/40">
          <img
            src={pokeballSprite}
            alt="Pokéball icon"
            className="h-10 w-10 drop-shadow-[0_4px_10px_rgba(15,23,42,0.6)]"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div>
          <p className="text-sm tracking-wide text-emerald-100 uppercase">Ready for a challenge?</p>
          <p className="text-2xl font-semibold">Start Encounter</p>
        </div>
      </div>
      <p className="mt-6 text-base text-slate-100/90">
        Face a new wild Pokémon and grow your collection with quick math battles.
      </p>
    </button>
  );
}
