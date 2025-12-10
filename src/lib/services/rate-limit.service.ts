export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

interface RateLimiterEntry {
  count: number;
  expiresAt: number;
}

const GLOBAL_STORE_KEY = '__POKEMATH_RATE_LIMITER__';

type GlobalWithRateLimiter = typeof globalThis & {
  [GLOBAL_STORE_KEY]?: Map<string, RateLimiterEntry>;
};

const getStore = (): Map<string, RateLimiterEntry> => {
  const globalWithStore = globalThis as GlobalWithRateLimiter;
  const store = (globalWithStore[GLOBAL_STORE_KEY] ??= new Map<string, RateLimiterEntry>());
  return store;
};

export class RateLimiterError extends Error {
  constructor(
    message: string,
    public readonly code: 'RATE_LIMIT_EXCEEDED',
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'RateLimiterError';
  }
}

/**
 * Simple in-memory fixed-window rate limiter.
 * Provides best-effort protection for API routes until Upstash/Redis is wired.
 */
export class RateLimiter {
  private readonly store = getStore();

  constructor(private readonly options: RateLimiterOptions) {}

  /**
   * Consume a single token for the provided key.
   * Throws when the limit is exceeded; caller should map to HTTP 429.
   */
  async consume(key: string): Promise<void> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      this.store.set(key, { count: 1, expiresAt: now + this.options.windowMs });
      return;
    }

    if (entry.count >= this.options.limit) {
      const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);
      throw new RateLimiterError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        Math.max(retryAfterSeconds, 1),
      );
    }

    entry.count += 1;
    this.store.set(key, entry);
  }
}
