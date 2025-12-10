import { memo, useMemo } from 'react';

import type { PokemonTypeDto, TypeBreakdownDto } from '@/types';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { TYPE_COLOR_MAP, type TypeColorSet } from '@/lib/type-colors';
import { getTypeIconSrc } from '@/lib/type-icons';
import { cn } from '@/lib/utils';

const FALLBACK_COLORS: TypeColorSet = {
  light: '#d0d7ff',
  base: '#6474ff',
  dark: '#1f2355',
};

interface TypeProgressMeta {
  readonly id: number;
  readonly slug: string;
  readonly label: string;
  readonly iconPath: string | null;
  readonly total: number;
}

interface TypeProgressCard extends TypeProgressMeta {
  readonly captured: number;
  readonly progress: number;
}

const withIcon = (slug: string): string | null => getTypeIconSrc(slug);

const TYPE_METADATA: readonly TypeProgressMeta[] = [
  { id: 1, slug: 'normal', label: 'Normal', iconPath: withIcon('normal'), total: 22 },
  { id: 2, slug: 'fighting', label: 'Fighting', iconPath: withIcon('fighting'), total: 8 },
  { id: 3, slug: 'flying', label: 'Flying', iconPath: withIcon('flying'), total: 19 },
  { id: 4, slug: 'poison', label: 'Poison', iconPath: withIcon('poison'), total: 33 },
  { id: 5, slug: 'ground', label: 'Ground', iconPath: withIcon('ground'), total: 14 },
  { id: 6, slug: 'rock', label: 'Rock', iconPath: withIcon('rock'), total: 11 },
  { id: 7, slug: 'bug', label: 'Bug', iconPath: withIcon('bug'), total: 12 },
  { id: 8, slug: 'ghost', label: 'Ghost', iconPath: withIcon('ghost'), total: 3 },
  { id: 9, slug: 'steel', label: 'Steel', iconPath: withIcon('steel'), total: 2 },
  { id: 10, slug: 'fire', label: 'Fire', iconPath: withIcon('fire'), total: 12 },
  { id: 11, slug: 'water', label: 'Water', iconPath: withIcon('water'), total: 32 },
  { id: 12, slug: 'grass', label: 'Grass', iconPath: withIcon('grass'), total: 14 },
  { id: 13, slug: 'electric', label: 'Electric', iconPath: withIcon('electric'), total: 9 },
  { id: 14, slug: 'psychic', label: 'Psychic', iconPath: withIcon('psychic'), total: 14 },
  { id: 15, slug: 'ice', label: 'Ice', iconPath: withIcon('ice'), total: 5 },
  { id: 16, slug: 'dragon', label: 'Dragon', iconPath: withIcon('dragon'), total: 3 },
  { id: 17, slug: 'dark', label: 'Dark', iconPath: withIcon('dark'), total: 0 },
  { id: 18, slug: 'fairy', label: 'Fairy', iconPath: withIcon('fairy'), total: 5 },
] as const;

export interface TypeProgressGridProps {
  readonly breakdown: TypeBreakdownDto[];
  readonly className?: string;
  readonly selectedTypeId?: number | null;
  readonly onTypeSelect?: (typeId: number | null) => void;
}

const TypeProgressGrid = memo(function TypeProgressGrid({
  breakdown,
  className,
  selectedTypeId = null,
  onTypeSelect,
}: TypeProgressGridProps) {
  const capturedById = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of breakdown ?? []) {
      if (typeof entry.typeId !== 'number') continue;
      map.set(entry.typeId, entry.count ?? 0);
    }
    return map;
  }, [breakdown]);

  const cards: TypeProgressCard[] = useMemo(
    () =>
      TYPE_METADATA.map((meta) => {
        const captured = Math.max(0, capturedById.get(meta.id) ?? 0);
        const total = Math.max(0, meta.total);
        const progress = total > 0 ? Math.min(1, captured / total) : captured > 0 ? 1 : 0;
        return {
          ...meta,
          captured,
          progress,
        };
      }),
    [capturedById],
  );

  const interactive = typeof onTypeSelect === 'function';
  const filterActive = typeof selectedTypeId === 'number';

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9',
        className,
      )}
    >
      {cards.map((card) => {
        const palette = TYPE_COLOR_MAP[card.slug] ?? FALLBACK_COLORS;
        const isActive = interactive && selectedTypeId === card.id;
        const isDisabled = !interactive || card.captured <= 0;
        const shouldDim = interactive && filterActive && !isActive && !isDisabled;

        const handleClick = () => {
          if (!interactive || isDisabled) return;
          if (isActive) {
            onTypeSelect?.(null);
            return;
          }
          onTypeSelect?.(card.id);
        };

        return (
          <button
            key={card.id}
            type="button"
            disabled={isDisabled}
            onClick={handleClick}
            data-test-id={`type-filter-${card.slug}`}
            aria-pressed={interactive ? isActive : undefined}
            aria-label={`Filter by ${card.label}. ${card.captured} of ${card.total} captured.`}
            className={cn(
              'group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-slate-950 px-3 py-4 text-center transition focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none',
              isDisabled
                ? 'cursor-not-allowed border-white/5 text-slate-500'
                : isActive
                  ? 'border-white/70 text-white shadow-lg shadow-cyan-500/25'
                  : 'border-white/10 text-white hover:border-cyan-200/50 hover:shadow-md hover:shadow-cyan-500/10',
              shouldDim && 'opacity-60',
            )}
          >
            <TypeWaveBackground
              types={buildTypePayload(card)}
              className={cn(
                'pointer-events-none transition',
                isDisabled ? 'opacity-30 grayscale' : 'opacity-100',
              )}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/85 to-slate-950/95"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              {card.iconPath ? (
                <img
                  src={card.iconPath}
                  alt=""
                  role="presentation"
                  className={cn(
                    'h-8 w-8 object-contain drop-shadow-[0_2px_6px_rgba(2,6,23,0.45)] transition',
                    isDisabled && 'opacity-60 grayscale',
                    !isActive && !isDisabled && 'opacity-80 group-hover:opacity-100',
                  )}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tracking-wide text-slate-50 uppercase"
                  style={{ backgroundColor: palette.base }}
                >
                  {card.label[0]}
                </span>
              )}
              <span className="text-xs font-semibold tracking-wide uppercase">{card.label}</span>
              <span className="text-sm font-bold">
                {card.captured} / {card.total}
              </span>
              <div
                className={cn(
                  'mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15',
                  isDisabled && 'bg-white/5',
                )}
              >
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r from-white via-white to-white',
                    isDisabled && 'bg-white/30',
                  )}
                  style={{ width: `${card.progress * 100}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

function buildTypePayload(card: TypeProgressMeta): PokemonTypeDto[] {
  return [
    {
      id: card.id,
      name: card.slug,
      slot: 1,
    },
  ];
}

export default TypeProgressGrid;
