"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { DEMO_ORG_COOKIE, signInAsDemoBuyer } from "@/lib/auth/demo-users";
import { getRepository } from "@/lib/catalog/seed-repository";
import { demoAuthEnabled } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Switch which fictional demo buyer you're ordering for. With DEMO_AUTH on, this signs you
 * in as that buyer's demo account, so the database (RLS) only shows that buyer's data.
 */
export async function switchDemoBuyer(formData: FormData) {
  const id = String(formData.get("buyerId") ?? "");
  // Only accept ids that exist in the catalog; never trust form input blindly.
  if (!(await getRepository().getBuyer(id))) return;
  (await cookies()).set(DEMO_ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });

  const db = await createSupabaseServerClient();
  if (db && demoAuthEnabled()) {
    await db.auth.signOut({ scope: "local" });
    await signInAsDemoBuyer(db, id);
  }
  // The browser reloads after this resolves; the revalidation covers the no-JS form post.
  revalidatePath("/", "layout");
}
