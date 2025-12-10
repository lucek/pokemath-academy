import type { APIRoute } from 'astro';
import type { ErrorResponseDto, HealthCheckDto } from '../../types';
import { HealthCheckError, HealthService } from '../../lib/services/health.service';

export const prerender = false;

const DEGRADED_THRESHOLD_MS = 800;

/**
 * GET /api/health
 *
 * Lightweight readiness endpoint that pings Supabase and reports service status.
 */
export const GET: APIRoute = async (context) => {
  const overallStart = performance.now();

  try {
    const supabase = context.locals.supabase;

    if (!supabase) {
      // eslint-disable-next-line no-console
      console.error('[API /health] Missing Supabase client on context');

      return toJsonResponse(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Supabase client not configured',
          },
        },
        500,
      );
    }

    const healthService = new HealthService(supabase);
    const { database, latencyMs } = await healthService.checkDatabaseHealth();

    const status: HealthCheckDto['status'] =
      latencyMs > DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy';
    const payload: HealthCheckDto = {
      status,
      timestamp: new Date().toISOString(),
      database,
      version: import.meta.env.PUBLIC_APP_VERSION ?? 'dev',
    };

    const duration = performance.now() - overallStart;
    // eslint-disable-next-line no-console
    console.info('[API /health] Probe completed', {
      latencyMs,
      status,
      database,
      durationMs: duration.toFixed(2),
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const duration = performance.now() - overallStart;

    if (error instanceof HealthCheckError) {
      // eslint-disable-next-line no-console
      console.error('[API /health] Dependency check failed', {
        code: error.code,
        details: error.details,
        message: error.message,
        durationMs: duration.toFixed(2),
      });

      return toJsonResponse(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        503,
      );
    }

    // eslint-disable-next-line no-console
    console.error('[API /health] Unexpected error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration.toFixed(2),
    });

    return toJsonResponse(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to complete health check',
        },
      },
      500,
    );
  }
};

function toJsonResponse(body: HealthCheckDto | ErrorResponseDto, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
