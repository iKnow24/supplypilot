/**
 * DEMO AUTH. There is no sign-in yet: the "current buyer" is a cookie holding
 * one of the fictional demo organizations. It isolates which demo buyer's
 * prices you see, but it is NOT security. Supabase Auth replaces this.
 */
import "server-only";

import { cookies } from "next/headers";

import { getRepository } from "./catalog/seed-repository";

export const DEMO_ORG_COOKIE = "sp_demo_org";
export const DEFAULT_DEMO_ORG = "org_sundaycrumb";

export async function getCurrentBuyer() {
  const repo = getRepository();
  const store = await cookies();
  const id = store.get(DEMO_ORG_COOKIE)?.value ?? DEFAULT_DEMO_ORG;
  const buyer = (await repo.getBuyer(id)) ?? (await repo.getBuyer(DEFAULT_DEMO_ORG));
  if (!buyer) throw new Error("Demo catalog has no buyers");
  return buyer;
}
