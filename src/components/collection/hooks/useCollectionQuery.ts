import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { CollectionQueryParams, CollectionResponseDto, ErrorResponseDto } from '@/types';
import { filtersToQueryParams } from '../filter-utils';
import {
  COLLECTION_PAGE_SIZE,
  TOTAL_POKEMON_COUNT,
  type CollectionFiltersState,
  type CollectionGridItemVm,
  type CollectionViewStatus,
  type PaginationState,
} from '../types';
import { mapCollectionResponseToViewModel, mergeCollectionItems } from '../mappers';

interface UseCollectionQueryOptions {
  pageSize?: number;
}

interface UseCollectionQueryResult {
  items: CollectionGridItemVm[];
  status: CollectionViewStatus;
  pagination: PaginationState;
  isFetchingMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

type FetchMode = 'replace' | 'append';

const hasWindow =
  typeof globalThis === 'object' && 'window' in globalThis && globalThis.window != null;
const browserWindow = hasWindow ? (globalThis.window as Window) : undefined;

export function useCollectionQuery(
  filters: CollectionFiltersState,
  options?: UseCollectionQueryOptions,
): UseCollectionQueryResult {
  const isAllFilter = filters.caught === 'all';
  const pageSize = isAllFilter ? TOTAL_POKEMON_COUNT : (options?.pageSize ?? COLLECTION_PAGE_SIZE);
  const [items, setItems] = useState<CollectionGridItemVm[]>([]);
  const [status, setStatus] = useState<CollectionViewStatus>({ status: 'idle' });
  const [pagination, setPagination] = useState<PaginationState>({
    limit: pageSize,
    offset: 0,
    total: 0,
    hasMore: true,
  });
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const filtersRef = useRef(filters);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const fetchPage = useCallback(
    async (offset: number, mode: FetchMode) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === 'replace') {
        setStatus({ status: 'loading' });
        setIsFetchingMore(false);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const queryParams = filtersToQueryParams(filtersRef.current, pageSize, offset);
        const baseResponse = await requestCollection(queryParams, controller.signal);
        const viewModel = mapCollectionResponseToViewModel(baseResponse);

        setItems((previous) =>
          mode === 'replace' ? viewModel.items : mergeCollectionItems(previous, viewModel.items),
        );
        setPagination({
          limit: viewModel.limit,
          offset: viewModel.offset + viewModel.limit,
          total: viewModel.total,
          hasMore: viewModel.hasMore,
        });
        setStatus({ status: 'success' });
      } catch (error) {
        const aborted = handleRequestFailure(error, setStatus);
        if (aborted) {
          return;
        }
      } finally {
        if (mode === 'append') {
          setIsFetchingMore(false);
        }
      }
    },
    [pageSize],
  );

  useEffect(() => {
    setItems([]);
    setPagination({
      limit: pageSize,
      offset: 0,
      total: 0,
      hasMore: true,
    });
    fetchPage(0, 'replace');
  }, [fetchPage, filtersKey, pageSize]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!pagination.hasMore || isFetchingMore || status.status !== 'success') {
      return;
    }

    fetchPage(pagination.offset, 'append');
  }, [fetchPage, isFetchingMore, pagination.hasMore, pagination.offset, status.status]);

  const refetch = useCallback(() => {
    fetchPage(0, 'replace');
  }, [fetchPage]);

  return {
    items,
    status,
    pagination,
    isFetchingMore,
    loadMore,
    refetch,
  };
}

function handleRequestFailure(
  error: unknown,
  setStatus: Dispatch<SetStateAction<CollectionViewStatus>>,
): boolean {
  if (isAbortError(error)) {
    return true;
  }

  if (error instanceof RequestError) {
    if (error.code === 'unauthorized' && browserWindow) {
      browserWindow.location.assign('/login');
    }

    setStatus({
      status: 'error',
      errorCode: error.code,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    });
    return false;
  }

  setStatus({
    status: 'error',
    errorCode: 'network',
    message: error instanceof Error ? error.message : 'Network error while loading collection.',
  });
  return false;
}

function buildQueryString(params: CollectionQueryParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

async function requestCollection(
  params: CollectionQueryParams,
  signal: AbortSignal,
): Promise<CollectionResponseDto> {
  const queryString = buildQueryString(params);
  const response = await fetch(`/api/collection?${queryString}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (response.status === 401) {
    throw new RequestError('unauthorized', 'Session expired. Redirecting to login...');
  }

  if (response.status === 429) {
    const retryAfterSeconds = Number.parseInt(response.headers.get('retry-after') ?? '0', 10);
    throw new RequestError(
      'rate_limit',
      'Too many requests. Try again soon.',
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
  }

  if (!response.ok) {
    const errorPayload = await safeParseError(response);
    throw new RequestError('server', errorPayload ?? 'Failed to load collection.');
  }

  return (await response.json()) as CollectionResponseDto;
}

type RequestErrorCode = 'unauthorized' | 'rate_limit' | 'server';

class RequestError extends Error {
  constructor(
    public readonly code: RequestErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function safeParseError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as ErrorResponseDto;
    return payload?.error?.message ?? null;
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
