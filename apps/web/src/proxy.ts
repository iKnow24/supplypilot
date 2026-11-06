/**
 * Runs before every page request:
 *  1. Refreshes the Supabase session cookie (tokens are short-lived).
 *  2. DEMO AUTH (DEMO_AUTH=on only): signs a visitor without a session in as the demo
 *     account of the fictional buyer they picked (cookie), so RLS is enforced for real
 *     without a login screen. See src/lib/auth/demo-users.ts.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_DEMO_ORG,
  DEMO_ORG_COOKIE,
  isOrgId,
  signInAsDemoBuyer,
} from "./lib/auth/demo-users";
import { demoAuthEnabled, supabaseEnv } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  const env = supabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  try {
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims && demoAuthEnabled()) {
      const picked = request.cookies.get(DEMO_ORG_COOKIE)?.value ?? DEFAULT_DEMO_ORG;
      const org = isOrgId(picked) ? picked : DEFAULT_DEMO_ORG;
      const first = await signInAsDemoBuyer(supabase, org);
      if (!first.ok && org !== DEFAULT_DEMO_ORG)
        await signInAsDemoBuyer(supabase, DEFAULT_DEMO_ORG);
    }
  } catch {
    // Database down: pages render their "not connected" state instead of crashing.
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
