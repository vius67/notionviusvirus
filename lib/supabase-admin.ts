import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role client — server-only, bypasses RLS. Never import from a client component.
// Built lazily so importing this module (e.g. during `next build` page-data collection)
// doesn't require the env vars to be present — only calling getSupabaseAdmin() does.
let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return client
}
