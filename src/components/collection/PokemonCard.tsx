import { memo, useEffect, useState } from 'react';

import type { CollectionGridItemVm } from './types';
import pokeballIcon from '@/assets/icons/pokeball_icon.png?url';
import { Sparkles } from 'lucide-react';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { cn } from '@/lib/utils';
import { getTypeIconSrc } from '@/lib/type-icons';

const FALLBACK_SPRITE = pokeballIcon;

interface PokemonCardProps {
  readonly item: CollectionGridItemVm;
  readonly onClick: (pokemonId: number) => void;
}

export const PokemonCard = memo(function PokemonCard({ item, onClick }: PokemonCardProps) {
  const [spriteSrc, setSpriteSrc] = useState(item.displaySprite);
  const clickable = item.isCaught;
  const isUncaught = !clickable;
  const sortedTypes =
    item.showTypes && item.types.length > 0 ? [...item.types].sort((a, b) => a.slot - b.slot) : [];
  const showShinyBadge = item.badges.shiny;

  useEffect(() => {
    setSpriteSrc(item.displaySprite);
  }, [item.displaySprite]);

  const handleImageError = () => {
    setSpriteSrc(FALLBACK_SPRITE);
  };

  const handleClick = () => {
    if (!clickable) return;
    onClick(item.pokemonId);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!clickable}
      data-test-id={`collection-card-${item.name.toLowerCase()}`}
      aria-label={item.accessibleLabel}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border px-4 pt-5 pb-4 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none',
        clickable
          ? 'border-white/15 bg-slate-900/70 shadow-lg shadow-black/40 hover:-translate-y-1 hover:border-cyan-200/60'
          : 'border-dashed border-white/10 bg-slate-950/70 text-slate-500',
      )}
    >
      {showShinyBadge ? (
        <span className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-3xl">
          <span className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-cyan-300/10" />
          <span className="animate-shine-sweep absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)] opacity-70" />
        </span>
      ) : null}
      <TypeWaveBackground
        types={item.showTypes ? item.types : []}
        className={cn(
          'opacity-70 transition',
          item.backgroundVariant === 'uncaught' && 'opacity-50 brightness-75 grayscale saturate-0',
        )}
      />
      <div
        className={cn(
          'relative z-10 flex flex-1 flex-col items-center gap-3 text-white transition-opacity',
          isUncaught && 'opacity-70 grayscale',
        )}
      >
        <div className="flex w-full items-start justify-between gap-3 text-xs text-white/70">
          <span className="inline-flex h-6 items-center rounded-full border border-white/50 px-2 font-mono text-[11px] text-white/90 shadow shadow-black/30">
            #{item.pokedexNumber.toString().padStart(3, '0')}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {sortedTypes.length > 0 && (
              <div className="inline-flex h-6 items-center gap-1 overflow-hidden rounded-full border border-white/80 bg-slate-900/50 px-2 text-white shadow shadow-black/40">
                {sortedTypes.map((type) => {
                  const iconSrc = getTypeIconSrc(type.name);
                  const fallbackLabel = type.name.slice(0, 1).toUpperCase();
                  const key = `${item.pokemonId}-${type.id}-${type.slot}`;
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
            {showShinyBadge ? (
              <span className="inline-flex items-center gap-1 overflow-hidden rounded-full border border-yellow-400/60 bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-100 shadow ring-1 shadow-yellow-500/40 ring-yellow-400/50">
                <Sparkles className="size-3" aria-hidden="true" />
                Shiny
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative flex h-32 w-32 items-center justify-center">
          <img
            src={spriteSrc}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            className={cn(
              'h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(8,47,73,0.65)] transition duration-200 group-hover:scale-105',
              isUncaught &&
                'opacity-50 blur-[5px] brightness-0 contrast-200 drop-shadow-none grayscale saturate-0',
            )}
          />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-white capitalize">{item.displayName}</p>
          <p
            className={cn(
              'text-xs tracking-[0.3em] uppercase',
              clickable ? 'text-white/70' : 'text-white/40',
            )}
          >
            {clickable
              ? item.capturedAt
                ? new Date(item.capturedAt).toLocaleDateString()
                : 'Captured'
              : 'Not caught'}
          </p>
        </div>
      </div>
    </button>
  );
});
