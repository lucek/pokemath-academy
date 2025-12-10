import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionFiltersState } from '../types';
import { COLLECTION_DEFAULT_FILTERS, COLLECTION_FILTER_DEBOUNCE_MS } from '../types';
import {
  filtersFromSearch,
  filtersToQueryParams,
  filtersToSearchString,
  normalizeFilters,
} from '../filter-utils';
import type { CollectionQueryParams } from '@/types';

interface UseCollectionFiltersResult {
  filters: CollectionFiltersState;
  queryParams: CollectionQueryParams;
  searchString: string;
  isDefault: boolean;
  setFilters: (
    updater:
      | Partial<CollectionFiltersState>
      | ((prev: CollectionFiltersState) => CollectionFiltersState),
  ) => void;
  resetFilters: () => void;
}

const isBrowser = typeof window !== 'undefined';

export function useCollectionFilters(
  initialFilters?: CollectionFiltersState,
): UseCollectionFiltersResult {
  const [filters, setFiltersState] = useState<CollectionFiltersState>(() =>
    normalizeFilters(initialFilters ?? COLLECTION_DEFAULT_FILTERS),
  );
  const [searchString, setSearchString] = useState(() => filtersToSearchString(filters));
  const debounceRef = useRef<number | null>(null);

  const setFilters = useCallback<UseCollectionFiltersResult['setFilters']>((updater) => {
    setFiltersState((previous) => {
      const nextInput =
        typeof updater === 'function' ? updater(previous) : { ...previous, ...updater };
      return normalizeFilters(nextInput);
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(COLLECTION_DEFAULT_FILTERS);
  }, []);

  useEffect(() => {
    if (!isBrowser) return undefined;

    const nextSearch = filtersToSearchString(filters);
    setSearchString(nextSearch);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.search = nextSearch ? `?${nextSearch}` : '';
      window.history.replaceState(
        window.history.state,
        '',
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
      );
    }, COLLECTION_FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [filters]);

  useEffect(() => {
    if (!isBrowser) return undefined;

    const handlePopState = () => {
      const parsed = filtersFromSearch(new URLSearchParams(window.location.search));
      setFiltersState(parsed);
      setSearchString(filtersToSearchString(parsed));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const queryParams = useMemo<CollectionQueryParams>(
    () => filtersToQueryParams(filters),
    [filters],
  );
  const isDefault = useMemo(() => areFiltersEqual(filters, COLLECTION_DEFAULT_FILTERS), [filters]);

  return {
    filters,
    queryParams,
    searchString,
    isDefault,
    setFilters,
    resetFilters,
  };
}

function areFiltersEqual(a: CollectionFiltersState, b: CollectionFiltersState): boolean {
  return (
    a.caught === b.caught &&
    a.typeId === b.typeId &&
    a.variant === b.variant &&
    a.sort === b.sort &&
    a.order === b.order
  );
}
