import type { TypedSupabaseClient } from '../../db/supabase.client';

/**
 * Result of a database health probe.
 */
export interface HealthStatusResult {
  database: 'connected' | 'disconnected';
  latencyMs: number;
}

/**
 * Consistent error for health check failures.
 */
export class HealthCheckError extends Error {
  constructor(
    message: string,
    public readonly code: 'DATABASE_UNAVAILABLE' | 'HEALTH_TIMEOUT',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HealthCheckError';
  }
}

/**
 * Service responsible for probing downstream dependencies for the health endpoint.
 */
export class HealthService {
  private static readonly DEFAULT_TIMEOUT_MS = 2000;

  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Performs a lightweight HEAD query against Supabase to verify connectivity.
   *
   * @param timeoutMs - Maximum wait time for the probe before aborting.
   * @returns Database connectivity state together with measured latency.
   * @throws HealthCheckError when Supabase is unreachable or the request times out.
   */
  async checkDatabaseHealth(
    timeoutMs = HealthService.DEFAULT_TIMEOUT_MS,
  ): Promise<HealthStatusResult> {
    const timer = this.createTimeoutSignal(timeoutMs);
    const startedAt = this.now();

    try {
      const { error } = await this.supabase
        .from('pokemon')
        .select('id', { head: true })
        .limit(1)
        .abortSignal(timer.signal);

      const latencyMs = Math.round(this.now() - startedAt);

      if (error) {
        throw new HealthCheckError('Supabase responded with an error', 'DATABASE_UNAVAILABLE', {
          code: error.code,
          hint: error.hint,
          details: error.details,
        });
      }

      return {
        database: 'connected',
        latencyMs,
      };
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      if (this.isAbortError(error)) {
        throw new HealthCheckError('Health check request timed out', 'HEALTH_TIMEOUT');
      }

      throw new HealthCheckError('Unexpected failure during health probe', 'DATABASE_UNAVAILABLE', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      timer.cancel();
    }
  }

  /**
   * Creates an AbortSignal that cancels after the provided timeout.
   */
  private createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return {
      signal: controller.signal,
      cancel: () => clearTimeout(timeoutId),
    };
  }

  /**
   * Checks if a caught error represents an aborted request.
   */
  private isAbortError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
      return error.name === 'AbortError';
    }

    return error instanceof Error && error.name === 'AbortError';
  }

  /**
   * Provides a monotonic timestamp even in environments without performance.now.
   */
  private now(): number {
    if (typeof performance === 'undefined') {
      return Date.now();
    }

    return performance.now();
  }
}
