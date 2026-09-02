"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Browser-side Supabase client. Safe to use in Client Components —
 * it only ever holds the public anon key and is subject to RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
