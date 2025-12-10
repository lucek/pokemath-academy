import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Sign out endpoint
 * Clears the user's session and redirects to landing page
 */
export const GET: APIRoute = async ({ locals, redirect }) => {
  const { supabase } = locals;

  // Sign out the user
  await supabase.auth.signOut();

  // Redirect to landing page
  return redirect('/', 302);
};
