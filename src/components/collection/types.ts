import type { CollectionStatsDto, PokemonTypeDto } from '@/types';

export type CollectionCaughtFilter = 'all' | 'caught' | 'uncaught';
export type CollectionVariantFilter = 'all' | 'shiny' | 'normal';

export interface CollectionFiltersState {
  caught: CollectionCaughtFilter;
  typeId: number | null;
  variant: CollectionVariantFilter;
  sort: 'pokedex' | 'name' | 'date';
  order: 'asc' | 'desc';
}

export interface CollectionGridItemVm {
  pokemonId: number;
  name: string;
  displayName: string;
  pokedexNumber: number;
  displaySprite: string;
  isCaught: boolean;
  isShiny: boolean;
  capturedAt: string | null;
  types: PokemonTypeDto[];
  showTypes: boolean;
  backgroundVariant: 'captured' | 'uncaught';
  badges: {
    shiny: boolean;
  };
  accessibleLabel: string;
}

export interface CollectionStatsVm {
  totalCaptured: number;
  totalPossible: number;
  shinyCount: number;
  completionPercent: number;
  variantBreakdown: CollectionStatsDto['variantBreakdown'];
  typeBreakdown: CollectionStatsDto['typeBreakdown'];
}

export interface PaginationState {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export type CollectionViewErrorCode = 'unauthorized' | 'rate_limit' | 'server' | 'network';

export type CollectionViewStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | {
      status: 'error';
      errorCode: CollectionViewErrorCode;
      message: string;
      retryAfterSeconds?: number;
    };

export const COLLECTION_PAGE_SIZE = 30;
export const COLLECTION_FILTER_DEBOUNCE_MS = 300;
export const TOTAL_POKEMON_COUNT = 151;

export const COLLECTION_DEFAULT_FILTERS: CollectionFiltersState = Object.freeze({
  caught: 'all' as const,
  typeId: null,
  variant: 'all' as const,
  sort: 'pokedex' as const,
  order: 'asc' as const,
});
