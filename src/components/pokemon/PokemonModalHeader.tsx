import type { PokemonDetailHeaderVm, PokemonDetailViewModel } from '@/components/pokemon/types';
import type { PokemonTypeDto, VariantEnum } from '@/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { DividerVariant } from '@/components/pokemon/PokemonModalDivider';
import type { EncounterPokemonViewModel } from '@/components/encounter/types';
import { PokemonHeroSection } from '@/components/pokemon/PokemonHeroSection';
import type { ReactNode } from 'react';
import { buildWavePalette } from '@/lib/type-colors';
import { mapViewModelToHeaderVm } from '@/components/pokemon/mappers';

interface PokemonModalDividerConfig {
  readonly accentColor: string;
  readonly variant: DividerVariant;
}

interface PokemonModalHeroDetailConfig {
  readonly kind: 'detail';
  readonly id: number;
  readonly detail?: PokemonDetailViewModel;
  readonly isLoading: boolean;
  readonly onBack?: () => void;
  readonly className?: string;
  readonly variant?: VariantEnum;
  readonly onVariantChange?: (variant: VariantEnum) => void;
  readonly forceShinyUnlocked?: boolean;
}

interface PokemonModalHeroEncounterConfig {
  readonly kind: 'encounter';
  readonly pokemon?: EncounterPokemonViewModel | null;
  readonly hideSprite?: boolean;
  readonly className?: string;
}

type PokemonModalHeroConfig = PokemonModalHeroDetailConfig | PokemonModalHeroEncounterConfig;

export interface PokemonModalHeaderConfig {
  readonly hero: PokemonModalHeroConfig;
  readonly label: string;
  readonly types: PokemonTypeDto[];
  readonly divider?: PokemonModalDividerConfig;
  readonly overlay?: ReactNode;
  readonly backdropClassName?: string;
  readonly contentClassName?: string;
  readonly contentInnerClassName?: string;
  readonly contentWaveClassName?: string;
  readonly contentTextureSrc?: string;
}

interface PokemonModalHeaderProviderProps {
  readonly value: PokemonModalHeaderConfig;
  readonly children: ReactNode;
}

const PokemonModalHeaderContext = createContext<PokemonModalHeaderConfig | undefined>(undefined);

export function PokemonModalHeaderProvider({ value, children }: PokemonModalHeaderProviderProps) {
  return (
    <PokemonModalHeaderContext.Provider value={value}>
      {children}
    </PokemonModalHeaderContext.Provider>
  );
}

export function usePokemonModalHeaderConfig(): PokemonModalHeaderConfig {
  const context = useContext(PokemonModalHeaderContext);
  if (!context) {
    throw new Error('PokemonModalHeaderProvider is missing in the component tree.');
  }
  return context;
}

export function PokemonModalHeader(): ReactNode {
  const { hero } = usePokemonModalHeaderConfig();
  if (hero.kind === 'detail') {
    return <PokemonModalDetailHeader hero={hero} />;
  }
  return <PokemonModalEncounterHeader hero={hero} />;
}

interface PokemonModalDetailHeaderProps {
  readonly hero: PokemonModalHeroDetailConfig;
}

function PokemonModalDetailHeader({ hero }: PokemonModalDetailHeaderProps) {
  const { id, detail, isLoading, onBack, className, variant, onVariantChange, forceShinyUnlocked } =
    hero;
  const [internalVariant, setInternalVariant] = useState<VariantEnum>('normal');

  const setVariantView = useCallback(
    (next: VariantEnum) => {
      if (onVariantChange) {
        onVariantChange(next);
        return;
      }
      setInternalVariant(next);
    },
    [onVariantChange],
  );

  useEffect(() => {
    setVariantView('normal');
  }, [id, setVariantView]);

  const selectedVariant = variant ?? internalVariant;

  const ownedVariants = useMemo(
    () => detail?.captureStatus?.owned ?? [],
    [detail?.captureStatus?.owned],
  );
  const shinyUnlocked =
    forceShinyUnlocked ?? ownedVariants.some((entry) => entry.variant === 'shiny');
  const normalOwned = ownedVariants.some((entry) => entry.variant === 'normal');

  useEffect(() => {
    if (!shinyUnlocked) {
      return;
    }
    // If user only owns shiny, make it the default view for clarity.
    if (!normalOwned) {
      setVariantView('shiny');
    }
  }, [normalOwned, setVariantView, shinyUnlocked]);

  useEffect(() => {
    if (!shinyUnlocked && selectedVariant === 'shiny') {
      setVariantView('normal');
    }
  }, [selectedVariant, setVariantView, shinyUnlocked]);

  const heroVm = useMemo<PokemonDetailHeaderVm | undefined>(
    () =>
      detail
        ? mapViewModelToHeaderVm(detail, { useShiny: selectedVariant === 'shiny' })
        : undefined,
    [detail, selectedVariant],
  );

  if (!heroVm || isLoading) {
    return <HeroSkeleton />;
  }

  return (
    <PokemonHeroSection
      pokemon={heroVm}
      captureStatus={detail?.captureStatus}
      onBack={onBack}
      selectedVariant={selectedVariant}
      isShinyUnlocked={shinyUnlocked}
      onVariantChange={setVariantView}
      className={className}
    />
  );
}

interface PokemonModalEncounterHeaderProps {
  readonly hero: PokemonModalHeroEncounterConfig;
}

function PokemonModalEncounterHeader({ hero }: PokemonModalEncounterHeaderProps) {
  const { pokemon, hideSprite, className } = hero;
  if (!pokemon) {
    return null;
  }
  return <PokemonHeroSection pokemon={pokemon} isSpriteHidden={hideSprite} className={className} />;
}

function HeroSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#070a16]">
      <div className="h-24 w-24 animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

interface DetailHeaderConfigOptions {
  readonly id: number;
  readonly detail?: PokemonDetailViewModel;
  readonly isLoading?: boolean;
  readonly variant?: VariantEnum;
  readonly onVariantChange?: (variant: VariantEnum) => void;
  readonly forceShinyUnlocked?: boolean;
}

export function createDetailModalHeaderConfig({
  id,
  detail,
  isLoading = false,
  variant,
  onVariantChange,
  forceShinyUnlocked,
}: DetailHeaderConfigOptions): PokemonModalHeaderConfig {
  const heroTypes = detail?.types ?? [];
  const palette = buildWavePalette(heroTypes);
  const label = detail ? `Pokémon detail – ${detail.name}` : `Pokémon detail – #${id}`;
  return {
    hero: {
      kind: 'detail',
      id,
      detail,
      isLoading,
      onBack: undefined,
      className: 'min-h-[360px]',
      variant,
      onVariantChange,
      forceShinyUnlocked,
    },
    label,
    types: heroTypes,
    divider: {
      accentColor: palette.accent,
      variant: { kind: 'single' },
    },
    contentInnerClassName: 'flex h-full min-h-full flex-col gap-6 px-4 pb-0 pt-2 sm:px-8 sm:pt-3',
  };
}

interface EncounterHeaderConfigOptions {
  readonly pokemon?: EncounterPokemonViewModel | null;
  readonly divider?: PokemonModalDividerConfig;
  readonly overlay?: ReactNode;
  readonly contentClassName?: string;
  readonly contentWaveClassName?: string;
  readonly backdropClassName?: string;
  readonly hideSprite?: boolean;
  readonly label?: string;
}

export function createEncounterModalHeaderConfig({
  pokemon,
  divider,
  overlay,
  contentClassName,
  contentWaveClassName,
  backdropClassName,
  hideSprite,
  label,
}: EncounterHeaderConfigOptions): PokemonModalHeaderConfig {
  return {
    hero: {
      kind: 'encounter',
      pokemon: pokemon ?? undefined,
      hideSprite,
      className: 'min-h-[360px]',
    },
    label: label ?? 'Encounter dialog',
    types: pokemon?.types ?? [],
    divider,
    overlay,
    contentClassName,
    contentWaveClassName,
    backdropClassName,
  };
}
