import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * OAuth callback endpoint
 * Handles the redirect from OAuth providers (Google) and exchanges the code for a session
 */
export const GET: APIRoute = async ({ url, redirect, locals }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (!code) {
    // If no code, redirect to home page
    return redirect('/', 302);
  }

  const supabase = locals.supabase;

  // Exchange the code for a session
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // On error, redirect to home page
    // eslint-disable-next-line no-console
    console.error('Error exchanging code for session:', error);
    return redirect('/', 302);
  }

  // Successful authentication - redirect to dashboard
  return redirect(next, 302);
};
