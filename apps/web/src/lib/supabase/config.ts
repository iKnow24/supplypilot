/**
 * Supabase connection settings. Both values are PUBLIC (URL + publishable/anon key); RLS is
 * what protects data. The service-role key is never used by the web app.
 */
export interface SupabaseEnv {
  url: string;
  key: string;
}

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/**
 * DEMO AUTH: when on, a visitor without a session is signed in automatically as the demo
 * account of the selected fictional buyer. Only for synthetic demo data. Off unless
 * DEMO_AUTH=on (make db-env writes it for local development).
 */
export function demoAuthEnabled(): boolean {
  return process.env.DEMO_AUTH === "on";
}
