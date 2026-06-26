import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin (service-role) client. Bypasses RLS and can manage auth users.
 * SERVER-ONLY — never import into client code; the service-role key must never
 * reach the browser. Used for privileged operations like assigning roles.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
