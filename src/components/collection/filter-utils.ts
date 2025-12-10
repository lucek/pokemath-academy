import type { CollectionQueryInput } from '@/lib/validation/collection.schema';
import type { CollectionQueryParams } from '@/types';
import {
  COLLECTION_DEFAULT_FILTERS,
  COLLECTION_FILTER_DEBOUNCE_MS,
  type CollectionCaughtFilter,
  type CollectionFiltersState,
  type CollectionVariantFilter,
} from './types';

const SORT_FIELDS = new Set<CollectionFiltersState['sort']>(['pokedex', 'name', 'date']);
const SORT_ORDERS = new Set<CollectionFiltersState['order']>(['asc', 'desc']);

export function normalizeFilters(
  input: Partial<CollectionFiltersState> | CollectionFiltersState,
): CollectionFiltersState {
  const base: CollectionFiltersState = { ...COLLECTION_DEFAULT_FILTERS, ...input };
  const normalized: CollectionFiltersState = {
    caught: normalizeCaught(base.caught),
    typeId: normalizeTypeId(base.typeId),
    variant: normalizeVariant(base.variant ?? (input as { shinyOnly?: unknown }).shinyOnly),
    sort: SORT_FIELDS.has(base.sort) ? base.sort : 'pokedex',
    order: SORT_ORDERS.has(base.order) ? base.order : 'asc',
  };

  if (normalized.caught === 'uncaught' && normalized.variant === 'shiny') {
    normalized.variant = 'all';
  } else if (normalized.variant === 'shiny') {
    normalized.caught = 'caught';
  }

  return normalized;
}

export function filtersFromQueryInput(query: CollectionQueryInput): CollectionFiltersState {
  return normalizeFilters({
    caught: query.caught === true ? 'caught' : query.caught === false ? 'uncaught' : 'all',
    typeId: query.type ?? null,
    variant: query.shiny ? 'shiny' : 'all',
    sort: query.sort,
    order: query.order,
  });
}

export function filtersFromSearch(searchParams: URLSearchParams): CollectionFiltersState {
  const caughtParam = searchParams.get('caught');
  const typeParam = searchParams.get('type');
  const shinyParam = searchParams.get('shiny');
  const variantParam = searchParams.get('variant');
  const sortParam = searchParams.get('sort');
  const orderParam = searchParams.get('order');

  let caught: CollectionCaughtFilter = 'all';
  if (caughtParam === 'true' || caughtParam === 'caught') {
    caught = 'caught';
  } else if (caughtParam === 'false' || caughtParam === 'uncaught') {
    caught = 'uncaught';
  }

  const typeId = typeParam ? parseNumeric(typeParam) : null;
  const variant: CollectionVariantFilter =
    variantParam === 'normal'
      ? 'normal'
      : shinyParam === 'true' || shinyParam === '1'
        ? 'shiny'
        : 'all';
  const sort = (
    SORT_FIELDS.has(sortParam as CollectionFiltersState['sort']) ? sortParam : 'pokedex'
  ) as CollectionFiltersState['sort'] | undefined;
  const order = (
    SORT_ORDERS.has(orderParam as CollectionFiltersState['order']) ? orderParam : 'asc'
  ) as CollectionFiltersState['order'] | undefined;

  return normalizeFilters({
    caught,
    typeId,
    variant,
    sort,
    order,
  });
}

export function filtersToQueryParams(
  filters: CollectionFiltersState,
  limit?: number,
  offset?: number,
  overrides?: Partial<CollectionQueryParams>,
): CollectionQueryParams {
  const base: CollectionQueryParams = {
    caught: filters.caught === 'all' ? undefined : filters.caught === 'caught',
    type: filters.typeId ?? undefined,
    shiny: filters.variant === 'shiny' ? true : undefined,
    sort: filters.sort,
    order: filters.order,
  };

  if (typeof limit === 'number') {
    base.limit = limit;
  }

  if (typeof offset === 'number') {
    base.offset = offset;
  }

  if (overrides) {
    return {
      ...base,
      ...overrides,
    };
  }

  return base;
}

export function filtersToSearchString(filters: CollectionFiltersState): string {
  const params = new URLSearchParams();

  if (filters.caught === 'caught') {
    params.set('caught', 'true');
  } else if (filters.caught === 'uncaught') {
    params.set('caught', 'false');
  }

  if (typeof filters.typeId === 'number' && Number.isFinite(filters.typeId)) {
    params.set('type', String(filters.typeId));
  }

  if (filters.variant === 'shiny') {
    params.set('shiny', 'true');
  } else if (filters.variant === 'normal') {
    params.set('variant', 'normal');
  }

  if (filters.sort !== COLLECTION_DEFAULT_FILTERS.sort) {
    params.set('sort', filters.sort);
  }

  if (filters.order !== COLLECTION_DEFAULT_FILTERS.order) {
    params.set('order', filters.order);
  }

  return params.toString();
}

export { COLLECTION_FILTER_DEBOUNCE_MS };

function normalizeCaught(
  value: CollectionFiltersState['caught'] | string | null | undefined,
): CollectionCaughtFilter {
  if (value === 'caught' || value === true || value === 'true') return 'caught';
  if (value === 'uncaught' || value === false || value === 'false') return 'uncaught';
  return 'all';
}

function normalizeTypeId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return parseNumeric(value);
  }

  return null;
}

function parseNumeric(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeVariant(value: unknown): CollectionVariantFilter {
  if (value === 'shiny' || value === 'normal') {
    return value;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return 'shiny';
  }
  return 'all';
}
