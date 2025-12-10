import type { Database } from './database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Typed Supabase client for the application
 * This type should be used throughout the application instead of importing
 * SupabaseClient directly from @supabase/supabase-js
 */
export type TypedSupabaseClient = SupabaseClient<Database>;
