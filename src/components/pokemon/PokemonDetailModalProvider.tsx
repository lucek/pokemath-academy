import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PokemonDetailModal } from '@/components/pokemon/PokemonDetailModal';
import { usePokemonDetailViewModel } from '@/components/pokemon/hooks';
import { useQueryClient } from '@tanstack/react-query';

interface PokemonDetailModalContextValue {
  readonly open: (pokemonId: number) => void;
  readonly close: () => void;
  readonly pokemonId: number | null;
  readonly isOpen: boolean;
}

const PokemonDetailModalContext = createContext<PokemonDetailModalContextValue | undefined>(
  undefined,
);

interface PokemonDetailModalProviderProps {
  readonly children: ReactNode;
}

const MODAL_STATE_KEY = 'pokemon-detail';

function extractPokemonIdFromPath(pathname: string): number | null {
  const match = /^\/pokemon\/(\d+)/.exec(pathname);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function PokemonDetailModalProvider({ children }: PokemonDetailModalProviderProps) {
  const [pokemonId, setPokemonId] = useState<number | null>(null);
  const basePathRef = useRef<string | null>(null);
  const isBrowser = typeof window !== 'undefined';
  const queryClient = useQueryClient();

  const { detail, isLoading, error, refetch } = usePokemonDetailViewModel(pokemonId ?? 0);

  const open = useCallback(
    (id: number) => {
      if (!Number.isFinite(id) || id <= 0) {
        return;
      }

      // Remove cached data so every modal opening re-fetches fresh detail + capture info.
      try {
        queryClient.removeQueries({ queryKey: ['pokemon-detail', id], exact: true });
        queryClient.removeQueries({ queryKey: ['pokemon-capture-status', id], exact: true });
      } catch {
        /* noop */
      }

      if (isBrowser) {
        const currentPath = getCurrentPath();
        const basePath = basePathRef.current ?? currentPath;
        basePathRef.current = basePath;
        const statePayload = { key: MODAL_STATE_KEY, basePath };
        const nextUrl = `/pokemon/${id}`;
        if (pokemonId === null) {
          window.history.pushState(statePayload, '', nextUrl);
        } else {
          window.history.replaceState(statePayload, '', nextUrl);
        }
      }
      setPokemonId(id);
    },
    [isBrowser, pokemonId, queryClient],
  );

  const close = useCallback(() => {
    if (pokemonId === null) {
      return;
    }
    if (isBrowser) {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const fallbackPath = '/dashboard';
      const targetPath =
        basePathRef.current && !basePathRef.current.startsWith('/pokemon/')
          ? basePathRef.current
          : fallbackPath;

      if (currentPath !== targetPath) {
        window.history.replaceState(null, '', targetPath);
      }

      setPokemonId(null);
      basePathRef.current = null;
      return;
    }
    setPokemonId(null);
    basePathRef.current = null;
  }, [isBrowser, pokemonId]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const nextId = extractPokemonIdFromPath(window.location.pathname);
      if (nextId) {
        const basePathFromState =
          typeof event.state?.basePath === 'string'
            ? (event.state.basePath as string)
            : basePathRef.current;
        if (basePathFromState) {
          basePathRef.current = basePathFromState;
        }
        setPokemonId(nextId);
        return;
      }
      setPokemonId(null);
      basePathRef.current = null;
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isBrowser]);

  const contextValue = useMemo<PokemonDetailModalContextValue>(
    () => ({
      open,
      close,
      pokemonId,
      isOpen: pokemonId !== null,
    }),
    [close, open, pokemonId],
  );

  return (
    <PokemonDetailModalContext.Provider value={contextValue}>
      {children}
      <PokemonDetailModal
        id={pokemonId ?? 0}
        isOpen={pokemonId !== null}
        onRequestClose={close}
        detail={pokemonId !== null ? detail : undefined}
        isLoading={pokemonId !== null && isLoading}
        error={pokemonId !== null ? error : undefined}
        onRetry={pokemonId !== null ? refetch : undefined}
        onSelectEvolution={open}
      />
    </PokemonDetailModalContext.Provider>
  );
}

export function usePokemonDetailModal(): PokemonDetailModalContextValue {
  const ctx = useContext(PokemonDetailModalContext);
  if (ctx) {
    return ctx;
  }

  return {
    pokemonId: null,
    isOpen: false,
    open: (id: number) => {
      if (!Number.isFinite(id) || id <= 0) return;
      if (typeof window === 'undefined') return;
      window.location.assign(`/pokemon/${id}`);
    },
    close: () => {
      if (typeof window === 'undefined') return;
      window.location.replace('/dashboard');
    },
  };
}
