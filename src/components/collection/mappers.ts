import type { CollectionItemDto, CollectionResponseDto } from '@/types';
import type { CollectionGridItemVm } from './types';
import pokeballIcon from '@/assets/icons/pokeball_icon.png?url';

const PLACEHOLDER_SPRITE = pokeballIcon;

export function mapCollectionItemToGridItem(item: CollectionItemDto): CollectionGridItemVm {
  const isCaught = item.isCaught;
  const isShiny = item.variant === 'shiny';
  const sprite = selectSprite(item, isShiny);

  return {
    pokemonId: item.pokemonId,
    name: item.name,
    displayName: isCaught ? item.name : '???',
    pokedexNumber: item.pokemonId,
    displaySprite: sprite ?? PLACEHOLDER_SPRITE,
    isCaught,
    isShiny,
    capturedAt: item.capturedAt ?? null,
    types: item.types ?? [],
    showTypes: isCaught,
    backgroundVariant: isCaught ? 'captured' : 'uncaught',
    badges: {
      shiny: isShiny,
    },
    accessibleLabel: buildAccessibleLabel(item, isCaught, isShiny),
  };
}

export function mapCollectionResponseToViewModel(response: CollectionResponseDto): {
  items: CollectionGridItemVm[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
} {
  const mapped = response.data.map(mapCollectionItemToGridItem);
  const { total, limit, offset, hasMore } = response.pagination;

  return {
    items: mapped,
    total,
    limit,
    offset,
    hasMore,
  };
}

export function mergeCollectionItems(
  current: CollectionGridItemVm[],
  next: CollectionGridItemVm[],
): CollectionGridItemVm[] {
  if (current.length === 0) {
    return next;
  }

  const lookup = new Map<string, CollectionGridItemVm>();
  const order: string[] = [];

  for (const item of current) {
    const key = buildKey(item);
    lookup.set(key, item);
    order.push(key);
  }

  for (const item of next) {
    const key = buildKey(item);
    if (!lookup.has(key)) {
      order.push(key);
    }
    lookup.set(key, item);
  }

  return order.map((key) => {
    const item = lookup.get(key);
    if (!item) {
      throw new Error(`Missing collection item for key ${key}`);
    }
    return item;
  });
}

function selectSprite(item: CollectionItemDto, isShiny: boolean): string {
  if (isShiny && item.sprites.front_shiny) {
    return item.sprites.front_shiny;
  }

  if (item.sprites.front_default) {
    return item.sprites.front_default;
  }

  return PLACEHOLDER_SPRITE;
}

function buildAccessibleLabel(
  item: CollectionItemDto,
  isCaught: boolean,
  isShiny: boolean,
): string {
  if (!isCaught) {
    return `Pokémon #${item.pokemonId} not yet caught`;
  }

  const variantLabel = isShiny ? 'shiny variant' : 'normal variant';
  return `${item.name} – ${variantLabel}`;
}

function buildKey(item: CollectionGridItemVm): string {
  return `${item.pokemonId}:${item.badges.shiny ? 'shiny' : 'normal'}`;
}
