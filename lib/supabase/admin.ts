import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS.
 * Only use in server code for operations that must work without a logged-in
 * user (e.g. public agreement signing). Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
