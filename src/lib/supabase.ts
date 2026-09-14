import { createClient } from '@supabase/supabase-js';

/**
 * Sanitizes the Supabase URL to ensure it contains only the project origin.
 * Any subpaths like '/rest/v1' or trailing slashes are stripped to avoid
 * PostgREST PGRST125 "Invalid path specified in request URL" errors.
 */
function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
export const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('http')
);

if (typeof window !== 'undefined') {
  console.log('[Supabase Init] Project Origin URL:', supabaseUrl, '| Configured:', isSupabaseConfigured);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
