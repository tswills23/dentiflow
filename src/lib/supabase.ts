import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

let _supabase: SupabaseClient<Database> | null = null;

// Service role client for backend operations (bypasses RLS)
// Lazily initialized so dotenv.config() has time to run first
export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    _supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

// Backwards-compatible named export (getter-backed)
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Anon client factory for user-scoped requests (respects RLS)
export function createAnonClient(accessToken?: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

  return createClient<Database>(url, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}
