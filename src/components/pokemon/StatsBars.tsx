import { useMemo } from 'react';

import type { PokemonStatsDto } from '@/types';
import type { StatsBarEntry } from './types';

const MAX_STAT = 255;

interface StatsBarsProps {
  readonly stats: PokemonStatsDto;
}

const STAT_CONFIG: { key: StatsBarEntry['key']; label: string; gradient: string }[] = [
  { key: 'hp', label: 'HP', gradient: 'from-emerald-400/80 to-emerald-500/60' },
  { key: 'attack', label: 'Attack', gradient: 'from-orange-400/80 to-orange-500/60' },
  { key: 'defense', label: 'Defense', gradient: 'from-sky-400/80 to-sky-500/60' },
  { key: 'speed', label: 'Speed', gradient: 'from-fuchsia-400/80 to-fuchsia-500/60' },
];

function buildEntries(stats: PokemonStatsDto): StatsBarEntry[] {
  return STAT_CONFIG.map((config) => {
    const rawValue = Number.isFinite(stats[config.key]) ? stats[config.key] : 0;
    const clampedValue = Math.max(0, Math.min(MAX_STAT, rawValue));
    return {
      key: config.key,
      label: config.label,
      value: clampedValue,
      percent: Math.round((clampedValue / MAX_STAT) * 100),
      color: config.gradient,
    };
  });
}

export function StatsBars({ stats }: StatsBarsProps) {
  const entries = useMemo(() => buildEntries(stats), [stats]);
  const heightMeters = Number.isFinite(stats.height) ? stats.height / 10 : null;
  const weightKg = Number.isFinite(stats.weight) ? stats.weight / 10 : null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#05060f]/70 px-5 py-6 text-white">
      <div className="flex justify-start gap-4 text-sm text-white/80">
        <div>
          <p className="text-xs tracking-[0.3em] text-white/60 uppercase">Height</p>
          <p className="mt-1 text-base font-semibold">
            {heightMeters ? `${heightMeters.toFixed(1)} m` : 'Unknown'}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-[0.3em] text-white/60 uppercase">Weight</p>
          <p className="mt-1 text-base font-semibold">
            {weightKg ? `${weightKg.toFixed(1)} kg` : 'Unknown'}
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {entries.map((entry) => (
          <div key={entry.key}>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>{entry.label}</span>
              <span className="font-semibold text-white">{entry.value}</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-white/10 backdrop-blur">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${entry.color}`}
                style={{ width: `${entry.percent}%` }}
                aria-valuenow={entry.value}
                aria-valuemin={0}
                aria-valuemax={MAX_STAT}
                role="progressbar"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
