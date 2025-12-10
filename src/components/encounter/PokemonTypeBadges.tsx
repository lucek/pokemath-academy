import type { PokemonTypeDto } from '@/types';

import { cn } from '@/lib/utils';
import { getTypeIconSrc } from '@/lib/type-icons';

interface PokemonTypeBadgesProps {
  readonly pokemonId: number;
  readonly types: PokemonTypeDto[];
  readonly className?: string;
}

export function PokemonTypeBadges({ pokemonId, types, className }: PokemonTypeBadgesProps) {
  if (types.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-white/80 uppercase',
        className,
      )}
    >
      {types.map((type) => (
        <TypeBadge key={`${pokemonId}-${type.id}-${type.slot}`} typeName={type.name} />
      ))}
    </div>
  );
}

interface TypeBadgeProps {
  readonly typeName: string;
}

const TypeBadge = ({ typeName }: TypeBadgeProps) => {
  const iconSrc = getTypeIconSrc(typeName);
  const label = typeName.toUpperCase();

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-slate-900/50 px-3 py-1 text-[11px] tracking-[0.3em] text-white">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt={`${label} type icon`}
          className="h-4 w-4 object-contain"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-xs font-bold" aria-hidden>
          {label.charAt(0)}
        </span>
      )}
      <span>{label}</span>
    </span>
  );
};
