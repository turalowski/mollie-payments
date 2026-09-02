import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Route Handlers, and Server
 * Actions. Uses the anon key + the caller's auth cookies, so it is
 * subject to RLS — reads are scoped to whichever user is signed in.
 *
 * Writing cookies from a Server Component is a no-op by design (Next.js
 * only allows it from a Route Handler or Server Action); the try/catch
 * mirrors the pattern from the @supabase/ssr docs so this file can be
 * safely imported from either.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — session refresh is handled
          // by middleware instead. Safe to ignore.
        }
      },
    },
  });
}
