import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Privileged Supabase client using the service-role key — bypasses RLS.
 *
 * Only import this from trusted server-side code (API routes, the Mollie
 * webhook handler) that needs to write rows on behalf of the system
 * rather than the currently signed-in user. The `server-only` import
 * above throws a build error if this ever ends up in client code.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
