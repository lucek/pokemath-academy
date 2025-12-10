import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CollectionStatsDto, ErrorResponseDto } from '@/types';
import { TOTAL_POKEMON_COUNT, type CollectionStatsVm } from '../types';

export interface CollectionStatsHookResult {
  stats: CollectionStatsVm | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

export function useCollectionStats(): CollectionStatsHookResult {
  const query = useQuery({
    queryKey: ['collection', 'stats', 'view'],
    queryFn: fetchCollectionStats,
    staleTime: 60 * 1000,
    retry: 2,
  });

  const stats = useMemo(() => query.data ?? null, [query.data]);

  return {
    stats,
    status: query.status,
    error: (query.error as Error) ?? null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

async function fetchCollectionStats(): Promise<CollectionStatsVm> {
  const response = await fetch('/api/collection/stats', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const details = await safeParseError(response);
    throw new Error(details ?? 'Failed to load collection stats.');
  }

  const payload = (await response.json()) as CollectionStatsDto;
  return mapStatsDtoToVm(payload);
}

function mapStatsDtoToVm(dto: CollectionStatsDto): CollectionStatsVm {
  const totalPossible = dto.totalPossible > 0 ? dto.totalPossible : TOTAL_POKEMON_COUNT;
  const totalCaptured = clamp(dto.totalCaptured, 0, totalPossible);
  const shinyCount = clamp(dto.shinyCount, 0, totalCaptured);
  const completionPercent = Math.round((totalCaptured / totalPossible) * 10000) / 100;

  return {
    totalCaptured,
    totalPossible,
    shinyCount,
    completionPercent,
    variantBreakdown: dto.variantBreakdown,
    typeBreakdown: dto.typeBreakdown,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function safeParseError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as ErrorResponseDto;
    return payload?.error?.message ?? null;
  } catch {
    return null;
  }
}
