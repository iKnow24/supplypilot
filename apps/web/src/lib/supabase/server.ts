import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "../db/database.types";
import { supabaseEnv } from "./config";

export type DbClient = SupabaseClient<Database>;

/** A Supabase client acting as the signed-in user (RLS applies). Null if not configured. */
export async function createSupabaseServerClient(): Promise<DbClient | null> {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies. The proxy refreshes sessions, so this is safe.
        }
      },
    },
  });
}
