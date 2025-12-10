import type { EncounterSession } from '../../types';

const GLOBAL_STORE_KEY = '__POKEMATH_ENCOUNTER_SESSIONS__';

interface EncounterSessionRecord {
  value: EncounterSession;
  expiresAtMs: number;
}

type GlobalWithEncounterSessions = typeof globalThis & {
  [GLOBAL_STORE_KEY]?: Map<string, EncounterSessionRecord>;
};

const getStore = (): Map<string, EncounterSessionRecord> => {
  const globalWithStore = globalThis as GlobalWithEncounterSessions;
  const store = (globalWithStore[GLOBAL_STORE_KEY] ??= new Map<string, EncounterSessionRecord>());
  return store;
};

const sessionStore = getStore();

/**
 * In-memory encounter session store used to validate answer submissions.
 *
 * This provides best-effort durability between requests within a single Node.js
 * instance. Each session carries its own expiration timestamp to simplify
 * garbage collection and future migration to Redis.
 */
export const EncounterSessionStore = {
  /**
   * Retrieve a session if it exists and has not expired.
   */
  get(encounterId: string): EncounterSession | undefined {
    const record = sessionStore.get(encounterId);
    if (!record) {
      return undefined;
    }

    if (isExpired(record)) {
      sessionStore.delete(encounterId);
      return undefined;
    }

    return record.value;
  },

  /**
   * Insert a new session, overwriting any previous value with the same id.
   */
  set(session: EncounterSession): void {
    const record = toRecord(session);
    sessionStore.set(session.encounterId, record);
    pruneExpired();
  },

  /**
   * Update an existing session; behaves like set but guards against missing ids.
   */
  update(session: EncounterSession): void {
    if (!sessionStore.has(session.encounterId)) {
      throw new ReferenceError(
        `[EncounterSessionStore] Cannot update missing session ${session.encounterId}`,
      );
    }

    EncounterSessionStore.set(session);
  },

  /**
   * Remove a session regardless of expiration.
   */
  delete(encounterId: string): void {
    sessionStore.delete(encounterId);
  },

  /**
   * Remove all expired sessions. Intended for lazy GC after reads/writes.
   */
  pruneExpired,
} as const;

function pruneExpired(): void {
  const now = Date.now();
  for (const [encounterId, record] of sessionStore.entries()) {
    if (record.expiresAtMs <= now) {
      sessionStore.delete(encounterId);
    }
  }
}

function toRecord(session: EncounterSession): EncounterSessionRecord {
  const expiresAtMs = Date.parse(session.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    throw new TypeError('[EncounterSessionStore] Invalid expiresAt timestamp provided.');
  }

  return {
    value: session,
    expiresAtMs,
  };
}

function isExpired(record: EncounterSessionRecord): boolean {
  return record.expiresAtMs <= Date.now();
}
