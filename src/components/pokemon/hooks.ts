import type { ErrorResponseDto, PokemonDetailDto } from '@/types';
import { useCallback, useMemo } from 'react';

import type { PokemonDetailViewModel } from '@/components/pokemon/types';
import { mapPokemonDetailToViewModel } from '@/components/pokemon/mappers';
import { useQuery } from '@tanstack/react-query';

async function safeJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function fetchPokemonDetail(id: number): Promise<PokemonDetailDto> {
  const response = await fetch(`/api/pokemon/${id}`);

  if (!response.ok) {
    const errorBody = (await safeJson<ErrorResponseDto>(response))?.error?.message;
    throw new Error(errorBody ?? `Failed to load Pokémon detail (HTTP ${response.status}).`);
  }

  return (await response.json()) as PokemonDetailDto;
}

export function usePokemonDetail(id: number) {
  return useQuery({
    queryKey: ['pokemon-detail', id],
    queryFn: () => fetchPokemonDetail(id),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

interface PokemonDetailViewModelResult {
  detail?: PokemonDetailViewModel;
  isLoading: boolean;
  error?: Error;
  refetch: () => void;
}

export function usePokemonDetailViewModel(id: number): PokemonDetailViewModelResult {
  const detailQuery = usePokemonDetail(id);

  const viewModel = useMemo(() => {
    if (!detailQuery.data) {
      return undefined;
    }
    return mapPokemonDetailToViewModel(
      detailQuery.data,
      detailQuery.data.capture_status ?? undefined,
    );
  }, [detailQuery.data]);

  const isLoading = detailQuery.isLoading;
  const error = useMemo(() => {
    const rawError = detailQuery.error;
    if (!rawError) {
      return undefined;
    }
    return rawError instanceof Error ? rawError : new Error(String(rawError));
  }, [detailQuery.error]);

  const refetch = useCallback(() => {
    void detailQuery.refetch();
  }, [detailQuery]);

  return {
    detail: viewModel,
    isLoading,
    error,
    refetch,
  };
}
