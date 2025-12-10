import type { Database } from '../db/database.types';
import type { TypedSupabaseClient } from '@/db/supabase.client';
import { createServerClient } from '@supabase/ssr';
import { defineMiddleware } from 'astro:middleware';

/**
 * Astro middleware for Supabase integration
 * Creates a Supabase client for each request and attaches it to context.locals
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const isE2EMockAuth =
    import.meta.env.E2E_AUTH_MOCK === 'true' ||
    import.meta.env.MODE === 'e2e' ||
    context.cookies.get('e2e-auth-mock')?.value === 'true';

  if (isE2EMockAuth) {
    // In e2e mode we bypass Supabase network calls to keep tests deterministic.
    Object.assign(context.locals, { supabase: createMockSupabaseClient() });
    return next();
  }

  // Create Supabase server client with cookie handling adapted for Astro
  const supabaseUrl = import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = import.meta.env.SUPABASE_KEY ?? import.meta.env.PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Server configuration error: missing Supabase env', { status: 500 });
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        // Astro doesn't have a getAll() method, so we need to reconstruct
        // cookies from the request header
        const cookieHeader = context.request.headers.get('cookie');
        if (!cookieHeader) return [];

        return cookieHeader.split('; ').map((cookie) => {
          const [name, ...valueParts] = cookie.split('=');
          const value = valueParts.join('=');
          return { name, value: decodeURIComponent(value || '') };
        });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });

  // Attach Supabase client to context for use in API routes and pages
  Object.assign(context.locals, { supabase });

  // Refresh session if it exists; if the refresh token is missing/invalid, clear
  // cookies and redirect the user to sign-in (for page requests). For API calls
  // we continue so handlers can return 401.
  const requestUrl = new URL(context.request.url);
  const isApiRoute = requestUrl.pathname.startsWith('/api');

  try {
    await supabase.auth.getUser();
  } catch (error) {
    const authError = error as { code?: string; status?: number; message?: string };
    const isRefreshTokenMissing =
      authError?.code === 'refresh_token_not_found' ||
      authError?.code === 'invalid_refresh_token' ||
      authError?.status === 400;

    if (isRefreshTokenMissing) {
      // eslint-disable-next-line no-console
      console.warn('[middleware] Invalid or missing Supabase refresh token, clearing session', {
        code: authError?.code,
        status: authError?.status,
        message: authError?.message,
      });

      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        // eslint-disable-next-line no-console
        console.error('[middleware] Failed to clear Supabase session after auth error', {
          error: signOutError instanceof Error ? signOutError.message : 'Unknown error',
        });
      }

      if (!isApiRoute) {
        return new Response(null, {
          status: 302,
          headers: { Location: '/' },
        });
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('[middleware] Unexpected Supabase auth error during getUser()', {
        message: authError?.message,
        code: authError?.code,
        status: authError?.status,
      });
    }
  }

  // Continue to route handler
  return next();
});

function createMockSupabaseClient(): TypedSupabaseClient {
  const noopQueryBuilder = {
    select: () => noopQueryBuilder,
    eq: () => noopQueryBuilder,
    gte: () => noopQueryBuilder,
    lte: () => noopQueryBuilder,
    limit: () => noopQueryBuilder,
    order: () => noopQueryBuilder,
    insert: () => noopQueryBuilder,
    update: () => noopQueryBuilder,
    delete: () => noopQueryBuilder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => noopQueryBuilder,
    rpc: async () => ({ data: null, error: null }),
  } as unknown as TypedSupabaseClient;
}
