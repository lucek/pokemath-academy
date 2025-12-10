import { beforeEach, describe, expect, it } from 'vitest';

import { EncounterSessionStore } from './encounter-session.service';
import type { EncounterSession } from '../../types';

type SessionStoreGlobal = typeof globalThis & {
  __POKEMATH_ENCOUNTER_SESSIONS__?: Map<string, unknown>;
};

const resetStore = (): Map<string, unknown> => {
  const globalWithStore = globalThis as SessionStoreGlobal;
  if (!globalWithStore.__POKEMATH_ENCOUNTER_SESSIONS__) {
    globalWithStore.__POKEMATH_ENCOUNTER_SESSIONS__ = new Map();
  }
  globalWithStore.__POKEMATH_ENCOUNTER_SESSIONS__.clear();
  return globalWithStore.__POKEMATH_ENCOUNTER_SESSIONS__;
};

const makeSession = (encounterId: string, expiresAt: string): EncounterSession => ({
  encounterId,
  userId: 'user-1',
  pokemonId: 1,
  pokemonName: 'bulbasaur',
  pokemonSprite: '/bulba.png',
  isShiny: false,
  stage: 1,
  questions: [
    {
      id: 'q1',
      question: '1 + 1 = ?',
      options: [2, 3, 4, 5],
      correctIndex: 0,
    },
  ],
  attemptsRemaining: 3,
  createdAt: new Date().toISOString(),
  expiresAt,
});

describe('EncounterSessionStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores and retrieves a session when not expired', () => {
    const session = makeSession('enc-active', new Date(Date.now() + 1_000).toISOString());

    EncounterSessionStore.set(session);
    const retrieved = EncounterSessionStore.get(session.encounterId);

    expect(retrieved).toEqual(session);
  });

  it('returns undefined and deletes expired sessions on get', () => {
    const store = resetStore();
    const expired = makeSession('enc-expired', new Date(Date.now() - 1_000).toISOString());

    EncounterSessionStore.set(expired);
    const retrieved = EncounterSessionStore.get(expired.encounterId);

    expect(retrieved).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('throws ReferenceError when updating a missing session', () => {
    const future = new Date(Date.now() + 2_000).toISOString();
    expect(() => EncounterSessionStore.update(makeSession('missing', future))).toThrow(
      ReferenceError,
    );
  });

  it('throws TypeError when set receives an invalid timestamp', () => {
    expect(() => EncounterSessionStore.set(makeSession('bad-timestamp', 'not-a-date'))).toThrow(
      TypeError,
    );
  });

  it('prunes only expired sessions', () => {
    const store = resetStore();
    const expired = makeSession('expired', new Date().toISOString());
    const active = makeSession('active', new Date(Date.now() + 10_000).toISOString());

    store.set('expired', { value: expired, expiresAtMs: Date.now() - 10 });
    store.set('active', { value: active, expiresAtMs: Date.now() + 10_000 });

    EncounterSessionStore.pruneExpired();

    expect(store.has('expired')).toBe(false);
    expect(store.has('active')).toBe(true);
  });
});
