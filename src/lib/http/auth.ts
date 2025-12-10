import type { APIRoute } from 'astro';
import type { TypedSupabaseClient } from '../../db/supabase.client';
import { HttpError } from './errors';

export function getSupabaseClient(
  context: Parameters<APIRoute>[0],
  routeLabel?: string,
): TypedSupabaseClient {
  const supabase = context.locals.supabase;
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.error(`${routeLabel ?? '[auth]'} Supabase client missing from context.`);

    throw new HttpError(500, {
      code: 'internal_server_error',
      message: 'Server configuration error. Please try again later.',
    });
  }

  return supabase;
}

export async function authenticateUser(
  supabase: TypedSupabaseClient,
  routeLabel?: string,
): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    // eslint-disable-next-line no-console
    console.warn(`${routeLabel ?? '[auth]'} Unauthorized request.`, {
      hasSession: Boolean(session),
      error: error?.message,
    });

    throw new HttpError(401, {
      code: 'unauthorized',
      message: 'Authentication required.',
    });
  }

  return session.user.id;
}
