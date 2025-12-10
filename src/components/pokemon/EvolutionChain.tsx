import type { EvolutionLineEntryVm, EvolutionLineViewModel } from '@/components/pokemon/types';

import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { useEvolutionChallengeAction } from '@/components/pokemon/ChallengeEvolutionButton';
import type { EncounterResponseDto } from '@/types';
import { cn } from '@/lib/utils';
import { getTypeIconSrc } from '@/lib/type-icons';

interface EvolutionChainProps {
  readonly line?: EvolutionLineViewModel;
  readonly onSelectEvolution?: (id: number) => void;
  readonly onOpenEncounter?: (response: EncounterResponseDto) => void;
  readonly className?: string;
}

const noopEncounter = () => {
  /* no-op */
};

export function EvolutionChain({
  line,
  onSelectEvolution,
  onOpenEncounter,
  className,
}: EvolutionChainProps) {
  if (!line || line.evolutions.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-white/15 px-4 py-6 text-center text-white/70 sm:px-6">
        <h3 className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
          Evolution line
        </h3>
        <p className="mt-2 text-sm">No evolution data available for this Pokémon.</p>
      </section>
    );
  }

  const shouldScroll = line.evolutions.length > 3;
  const density: EvolutionEntryDensity = shouldScroll ? 'compact' : 'comfortable';

  return (
    <section
      className={cn(
        'flex h-full flex-col rounded-[32px] border border-white/10 bg-[#070a16]/70 px-5 py-5 text-white',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
          Evolution line
        </h3>
      </div>

      <div
        className={cn(
          'mt-4 flex flex-1 flex-col gap-2 sm:mx-auto sm:w-full sm:max-w-[420px]',
          shouldScroll ? 'md:overflow-y-auto' : 'md:overflow-visible',
        )}
      >
        {line.evolutions.map((entry) => (
          <EvolutionEntry
            key={entry.id}
            entry={entry}
            density={density}
            onSelectEvolution={onSelectEvolution}
            onOpenEncounter={onOpenEncounter}
          />
        ))}
      </div>
    </section>
  );
}

interface EvolutionEntryProps {
  readonly entry: EvolutionLineEntryVm;
  readonly density: EvolutionEntryDensity;
  readonly onSelectEvolution?: (id: number) => void;
  readonly onOpenEncounter?: (response: EncounterResponseDto) => void;
}

type EvolutionEntryState = 'current' | 'captured' | 'ready' | 'locked';
type EvolutionEntryDensity = 'compact' | 'comfortable';

function EvolutionEntry({
  entry,
  density,
  onSelectEvolution,
  onOpenEncounter,
}: EvolutionEntryProps) {
  const canNavigate = Boolean(onSelectEvolution) && entry.inCollection && !entry.isCurrent;
  const state = getEntryState(entry);
  const isCurrent = state === 'current';
  const isCompactVariant = density === 'compact';
  const sortedTypes =
    entry.types.length > 0 ? [...entry.types].sort((a, b) => a.slot - b.slot) : [];
  const challengeTarget = entry.baseId ?? entry.id;
  const hasEncounterHandler = typeof onOpenEncounter === 'function' && entry.baseId != null;
  const { startChallenge, isDisabled, disabledReason } = useEvolutionChallengeAction({
    baseId: challengeTarget,
    evolutionId: entry.id,
    isBaseCaught: hasEncounterHandler && entry.canEvolve,
    onOpenEncounter: onOpenEncounter ?? noopEncounter,
  });
  const canChallenge = state === 'ready' && hasEncounterHandler && !isDisabled;
  const readyButDisabled = state === 'ready' && isDisabled && Boolean(disabledReason);

  const handleClick = () => {
    if (canNavigate) {
      onSelectEvolution?.(entry.id);
      return;
    }
    if (canChallenge) {
      startChallenge().catch(() => undefined);
    }
  };

  const badge = getBadge(state);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canNavigate && !canChallenge}
      className={cn(
        'group relative flex items-center rounded-2xl text-left text-sm transition',
        isCompactVariant
          ? 'min-h-[48px] gap-2 px-2.5 py-1 sm:gap-2.5 sm:px-3 sm:py-1.5'
          : 'min-h-[64px] gap-3 px-3.5 py-2 sm:gap-4 sm:px-4 sm:py-2.5',
        getButtonStateClasses(state, canNavigate, canChallenge),
      )}
      aria-current={isCurrent ? 'true' : undefined}
      title={readyButDisabled ? disabledReason : undefined}
      data-state={state}
    >
      <Sprite entry={entry} density={density} />
      <div className="relative z-10 flex flex-1 items-center justify-between gap-3">
        <div className="flex flex-col">
          <span
            className={cn(
              'font-semibold text-white capitalize',
              isCompactVariant ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
            )}
          >
            {entry.name}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {sortedTypes.length > 0 ? <TypeBadgeList types={sortedTypes} entryId={entry.id} /> : null}
          {badge}
        </div>
      </div>
    </button>
  );
}

interface SpriteProps {
  readonly entry: EvolutionLineEntryVm;
  readonly density: EvolutionEntryDensity;
}

function Sprite({ entry, density }: SpriteProps) {
  const isCompactVariant = density === 'compact';

  return (
    <div
      className={cn(
        'relative z-10 flex items-center justify-center overflow-hidden rounded-2xl',
        isCompactVariant ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-12 w-12 sm:h-14 sm:w-14',
      )}
    >
      <TypeWaveBackground
        types={entry.types}
        variant="card"
        className="absolute inset-0 opacity-90 mix-blend-screen"
      />
      <div className="absolute inset-0 bg-[#050812]/60" aria-hidden="true" />
      <img
        src={entry.sprite}
        alt={entry.name}
        loading="lazy"
        decoding="async"
        className={cn(
          'relative z-10 object-contain transition',
          isCompactVariant ? 'h-8 w-8 sm:h-10 sm:w-10' : 'h-10 w-10 sm:h-12 sm:w-12',
          entry.inCollection || entry.isCurrent ? '' : 'opacity-35 grayscale',
        )}
      />
    </div>
  );
}

interface TypeBadgeListProps {
  readonly types: EvolutionLineEntryVm['types'];
  readonly entryId: number;
}

function TypeBadgeList({ types, entryId }: TypeBadgeListProps) {
  return (
    <div className="inline-flex h-6 items-center gap-1 overflow-hidden rounded-full border border-white/80 bg-slate-900/50 px-2 text-white shadow shadow-black/30">
      {types.map((type) => {
        const iconSrc = getTypeIconSrc(type.name);
        const fallbackLabel = type.name.slice(0, 1).toUpperCase();
        const key = `${entryId}-${type.id}-${type.slot}`;

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
  );
}

function ReadyBadge() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/70 text-emerald-100">
      <span aria-hidden="true" className="text-base leading-none font-semibold">
        ↑
      </span>
    </span>
  );
}

function getEntryState(entry: EvolutionLineEntryVm): EvolutionEntryState {
  if (entry.isCurrent) {
    return 'current';
  }
  if (entry.inCollection) {
    return 'captured';
  }
  if (entry.canEvolve) {
    return 'ready';
  }
  return 'locked';
}

function getBadge(state: EvolutionEntryState) {
  if (state === 'ready') {
    return <ReadyBadge />;
  }
  return null;
}

function getButtonStateClasses(
  state: EvolutionEntryState,
  canNavigate: boolean,
  canChallenge: boolean,
): string {
  const classes = [
    'border',
    'border-white/10',
    'bg-white/5',
    'hover:border-white/25',
    'hover:bg-white/10',
  ];

  if (state === 'current') {
    classes.push(
      'border-cyan-200/70',
      'bg-gradient-to-r from-cyan-400/15 via-cyan-300/5 to-transparent',
    );
  }
  if (state === 'locked') {
    classes.push('opacity-40');
  }
  if (state === 'ready' && canChallenge) {
    classes.push('hover:border-emerald-400/60 hover:bg-white/10');
  }
  if (canNavigate) {
    classes.push('hover:border-white/30 hover:bg-white/10');
  }
  if (!canNavigate && !canChallenge) {
    classes.push('disabled:cursor-not-allowed');
  }

  return classes.join(' ');
}
