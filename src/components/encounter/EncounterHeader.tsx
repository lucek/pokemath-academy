import type { EncounterPokemonViewModel } from '@/components/encounter/types';

import pokeballSprite from '@/assets/icons/pokeball.png?url';
import { PokemonTypeBadges } from '@/components/encounter/PokemonTypeBadges';

interface EncounterHeaderProps {
  readonly pokemon: EncounterPokemonViewModel;
}

export function EncounterHeader({ pokemon }: EncounterHeaderProps) {
  const hasTypes = pokemon.types.length > 0;
  return (
    <header className="flex flex-col gap-8 text-white lg:flex-row lg:items-center lg:gap-12">
      <div className="relative mx-auto flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72">
        <div className="absolute inset-0 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <img
          src={pokemon.sprite}
          width={320}
          height={320}
          alt={`${pokemon.name} sprite`}
          className="relative h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
          onError={(e) => {
            const target = e.currentTarget;
            target.src = pokeballSprite;
          }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 text-center lg:items-start lg:text-left">
        {hasTypes ? (
          <PokemonTypeBadges
            pokemonId={pokemon.id}
            types={pokemon.types}
            className="justify-center lg:justify-start"
          />
        ) : (
          <p className="text-xs font-semibold tracking-[0.4em] text-white/70 uppercase">
            UNKNOWN TYPE
          </p>
        )}
        <h2 className="text-4xl font-bold tracking-tight capitalize sm:text-5xl">{pokemon.name}</h2>
        <p className="max-w-md text-sm text-white/70">
          {pokemon.flavorText ?? 'A mysterious Pokémon awaits your answers.'}
        </p>
      </div>
    </header>
  );
}
