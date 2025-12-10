import type { PokemonCaptureStatusDto, VariantEnum } from '@/types';

import { ArrowLeft } from 'lucide-react';
import { EncounterHeader } from '@/components/encounter/EncounterHeader';
import type { EncounterPokemonViewModel } from '@/components/encounter/types';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getBattleBackgroundSrc } from '@/components/encounter/battle-backgrounds';
import { useMemo } from 'react';

interface PokemonHeroSectionProps {
  readonly pokemon: EncounterPokemonViewModel;
  readonly captureStatus?: PokemonCaptureStatusDto;
  readonly isSpriteHidden?: boolean;
  readonly backgroundSrc?: string | null;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly onBack?: () => void;
  readonly selectedVariant?: VariantEnum;
  readonly isShinyUnlocked?: boolean;
  readonly onVariantChange?: (variant: VariantEnum) => void;
}

const VARIANT_ORDER: VariantEnum[] = ['normal', 'shiny'];
const VARIANT_LABEL: Record<VariantEnum, string> = {
  normal: 'Normal',
  shiny: 'Shiny',
};

export function PokemonHeroSection({
  pokemon,
  captureStatus,
  isSpriteHidden = false,
  backgroundSrc,
  className,
  children,
  onBack,
  selectedVariant,
  isShinyUnlocked = true,
  onVariantChange,
}: PokemonHeroSectionProps) {
  const computedBackground = useMemo(
    () => backgroundSrc ?? getBattleBackgroundSrc(pokemon.types),
    [backgroundSrc, pokemon.types],
  );
  const variant = selectedVariant ?? (pokemon.isShiny ? 'shiny' : 'normal');
  const shinyTooltip = isShinyUnlocked ? undefined : 'Catch the shiny variant to unlock';
  const canChangeVariant = typeof onVariantChange === 'function';
  const showVariantToggle = canChangeVariant && isShinyUnlocked;

  return (
    <div
      className={cn(
        'hero-battle-shell relative flex h-full w-full overflow-hidden bg-[#05060f]',
        className,
      )}
    >
      {computedBackground ? (
        <div className="absolute inset-0" aria-hidden>
          <img
            src={computedBackground}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}
      <div className="relative z-10 flex h-full flex-col justify-between px-4 pt-5 pb-8 sm:px-10 sm:pt-8">
        {(onBack || captureStatus) && (
          <div className="flex items-center justify-between gap-4 text-white">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold tracking-[0.2em] text-white/90 uppercase transition hover:-translate-y-0.5 hover:border-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
            ) : (
              <span aria-hidden />
            )}
          </div>
        )}
        <div className="flex flex-1 flex-col justify-center sm:justify-end">
          <div
            className={cn(
              'transition-opacity duration-500',
              isSpriteHidden ? 'opacity-0' : 'opacity-100',
            )}
            aria-live="off"
          >
            <EncounterHeader pokemon={pokemon} />
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {children}
            {showVariantToggle ? (
              <div
                className="inline-flex items-center rounded-full border border-white/30 bg-black/30 p-1 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase shadow-lg"
                aria-label="Sprite variant"
              >
                {VARIANT_ORDER.map((option) => {
                  const isActive = variant === option;
                  const isDisabled = option === 'shiny' && !isShinyUnlocked;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onVariantChange(option)}
                      disabled={isActive}
                      className={cn(
                        'rounded-full px-4 py-1.5 transition focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
                        isActive ? 'bg-white text-[#070a16]' : 'text-white/70 hover:text-white',
                        isDisabled ? 'cursor-not-allowed opacity-40' : '',
                      )}
                      aria-pressed={isActive}
                      aria-label={`${VARIANT_LABEL[option]} variant`}
                      title={option === 'shiny' ? shinyTooltip : undefined}
                    >
                      {VARIANT_LABEL[option]}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
