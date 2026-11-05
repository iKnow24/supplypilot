"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/catalog/seed-repository";
import { DEMO_ORG_COOKIE } from "@/lib/demo-session";

export async function switchDemoBuyer(formData: FormData) {
  const id = String(formData.get("buyerId") ?? "");
  // Only accept ids that exist in the catalog; never trust form input blindly.
  if (!(await getRepository().getBuyer(id))) return;
  (await cookies()).set(DEMO_ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
