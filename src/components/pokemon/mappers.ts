import type { PokemonDetailDto, PokemonCaptureStatusDto } from '@/types';
import type {
  PokemonDetailHeaderVm,
  PokemonDetailViewModel,
  EvolutionLineViewModel,
} from '@/components/pokemon/types';
import pokeballSprite from '@/assets/icons/pokeball.png?url';

interface HeaderOptions {
  readonly useShiny?: boolean;
  readonly stage?: 1 | 2 | 3;
}

const FALLBACK_SPRITE = pokeballSprite;

export function mapPokemonDetailToViewModel(
  detail: PokemonDetailDto,
  captureStatus?: PokemonCaptureStatusDto,
): PokemonDetailViewModel {
  const evolutionLine = mapEvolutionLineDtoToViewModel(detail.evolution_line);
  return {
    id: detail.id,
    name: detail.name,
    flavorText: detail.flavor_text,
    region: detail.region,
    types: detail.types ?? [],
    spriteNormal: detail.sprites.front_default ?? FALLBACK_SPRITE,
    spriteShiny: detail.sprites.front_shiny ?? detail.sprites.front_default ?? FALLBACK_SPRITE,
    stats: detail.stats,
    evolutionLine,
    captureStatus,
  };
}

export function mapDetailToHeaderVm(
  detail: PokemonDetailDto,
  options?: HeaderOptions & { captureStatus?: PokemonCaptureStatusDto },
): PokemonDetailHeaderVm {
  const useShiny = options?.useShiny ?? false;
  return {
    id: detail.id,
    name: detail.name,
    sprite: useShiny
      ? (detail.sprites.front_shiny ?? FALLBACK_SPRITE)
      : (detail.sprites.front_default ?? FALLBACK_SPRITE),
    isShiny: useShiny,
    stage: options?.stage ?? 1,
    variantLabel: useShiny ? 'Shiny' : 'Normal',
    flavorText: detail.flavor_text,
    types: detail.types ?? [],
  };
}

function mapEvolutionLineDtoToViewModel(
  dto?: PokemonDetailDto['evolution_line'] | null,
): EvolutionLineViewModel | undefined {
  if (!dto) {
    return undefined;
  }

  const pokemon = {
    id: dto.pokemon.id,
    name: dto.pokemon.name,
    sprite: dto.pokemon.sprite ?? FALLBACK_SPRITE,
    inCollection: dto.pokemon.in_collection,
  };

  const evolutions = dto.evolutions.map((entry) => ({
    id: entry.id,
    name: entry.name,
    sprite: entry.sprite ?? FALLBACK_SPRITE,
    types: entry.types ?? [],
    inCollection: entry.in_collection,
    isCurrent: entry.is_current,
    baseId: entry.base_id ?? null,
    canEvolve: entry.can_evolve,
  }));

  return {
    pokemon,
    evolutions,
  };
}

export function mapViewModelToHeaderVm(
  viewModel: PokemonDetailViewModel,
  options?: HeaderOptions,
): PokemonDetailHeaderVm {
  const useShiny = options?.useShiny ?? false;
  return {
    id: viewModel.id,
    name: viewModel.name,
    sprite: useShiny ? viewModel.spriteShiny : viewModel.spriteNormal,
    isShiny: useShiny,
    stage: options?.stage ?? 1,
    variantLabel: useShiny ? 'Shiny' : 'Normal',
    flavorText: viewModel.flavorText,
    types: viewModel.types,
  };
}
