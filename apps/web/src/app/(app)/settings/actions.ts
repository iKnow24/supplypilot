"use server";

import { redirect } from "next/navigation";

import { runBuyerAction } from "@/lib/actions/run";

/** Form action: put this demo business back to its starting state, then open Home. */
export async function resetDemoBusiness() {
  const result = await runBuyerAction(async ({ state, session }) => {
    if (!session.buyer.synthetic) return { ok: false, error: "Only demo businesses can be reset" };
    await state.resetDemo();
  });
  redirect(result.ok ? "/home" : `/settings?error=${encodeURIComponent(result.error)}`);
}
