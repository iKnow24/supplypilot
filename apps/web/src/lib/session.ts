/**
 * Who is ordering, and whether their work can be saved.
 *
 * - Supabase configured + signed in: the buyer is the org of the signed-in user, and
 *   `state` is a repository scoped to that org (RLS enforced by Postgres).
 * - Otherwise: read-only browsing as the demo buyer picked in the switcher cookie. Nothing
 *   is saved, and pages say so instead of pretending.
 */
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { DEFAULT_DEMO_ORG, DEMO_ORG_COOKIE } from "./auth/demo-users";
import type { BuyerSummary } from "./catalog/repository";
import { getRepository } from "./catalog/seed-repository";
import type { BuyerStateRepository } from "./buyer-state/repository";
import { SupabaseBuyerStateRepository } from "./buyer-state/supabase-repository";
import { createSupabaseServerClient } from "./supabase/server";

export type Persistence =
  | { status: "ready"; email: string | null }
  | { status: "unconfigured" }
  | { status: "signed_out" }
  /** Had a session, but it couldn't be renewed. Locally: Docker VM clock behind the host. */
  | { status: "session_expired" }
  | { status: "unavailable" };

export interface Session {
  buyer: BuyerSummary;
  persistence: Persistence;
  state: BuyerStateRepository | null;
}

async function cookieBuyer(): Promise<BuyerSummary> {
  const repo = getRepository();
  const id = (await cookies()).get(DEMO_ORG_COOKIE)?.value ?? DEFAULT_DEMO_ORG;
  const buyer = (await repo.getBuyer(id)) ?? (await repo.getBuyer(DEFAULT_DEMO_ORG));
  if (!buyer) throw new Error("Demo catalog has no buyers");
  return buyer;
}

/** Cached per request, so the layout and the page share one lookup. */
export const getSession = cache(async (): Promise<Session> => {
  const db = await createSupabaseServerClient();
  if (!db)
    return { buyer: await cookieBuyer(), persistence: { status: "unconfigured" }, state: null };

  try {
    const { data: auth, error: authError } = await db.auth.getClaims();
    if (authError && authError.name === "AuthRetryableFetchError") throw authError;
    const claims = auth?.claims;
    if (!claims) {
      const expired = !!authError && /expired/i.test(authError.message);
      return {
        buyer: await cookieBuyer(),
        persistence: { status: expired ? "session_expired" : "signed_out" },
        state: null,
      };
    }

    const { data: memberships, error } = await db
      .from("org_members")
      .select("org_id")
      .eq("user_id", claims.sub)
      .order("created_at")
      .limit(1);
    if (error) throw error;
    const buyer = memberships[0] ? await getRepository().getBuyer(memberships[0].org_id) : null;
    if (!buyer)
      return { buyer: await cookieBuyer(), persistence: { status: "signed_out" }, state: null };

    return {
      buyer,
      persistence: {
        status: "ready",
        email: typeof claims.email === "string" ? claims.email : null,
      },
      state: new SupabaseBuyerStateRepository(db, buyer.id),
    };
  } catch {
    return { buyer: await cookieBuyer(), persistence: { status: "unavailable" }, state: null };
  }
});

export async function getCurrentBuyer(): Promise<BuyerSummary> {
  return (await getSession()).buyer;
}

/** Plain-English reason saving is off, for notices and action errors. */
export function persistenceProblem(p: Persistence): string | null {
  switch (p.status) {
    case "ready":
      return null;
    case "unconfigured":
      return "Saving is off: no database is configured for this app (see README → Local database).";
    case "signed_out":
      return "You're not signed in, so nothing can be saved.";
    case "session_expired":
      return "Your sign-in expired and couldn't be renewed, so nothing can be saved.";
    case "unavailable":
      return "The database isn't responding, so changes can't be saved right now.";
  }
}
