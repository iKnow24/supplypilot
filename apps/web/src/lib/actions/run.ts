/**
 * Shared plumbing for buyer server actions. NOT a "use server" module on purpose: exporting
 * this from an action file would also expose it as a callable endpoint.
 *
 * Every action that goes through `runBuyerAction`:
 *  - acts only on the signed-in buyer's org (from the session, never from the form),
 *  - gets catalog lookups to re-validate ids, quantities and units (the browser is untrusted),
 *  - returns a result the UI can show instead of throwing.
 */
import "server-only";

import { revalidatePath } from "next/cache";

import { BuyerStateError, type BuyerStateRepository } from "../buyer-state/repository";
import { catalogContext } from "../cart/catalog-context";
import { getSession, persistenceProblem, type Session } from "../session";

export type ActionResult =
  { ok: true; message?: string; runId?: string; href?: string } | { ok: false; error: string };

export type ActionContext = Awaited<ReturnType<typeof catalogContext>> & {
  state: BuyerStateRepository;
  session: Session;
};

export async function runBuyerAction(
  fn: (ctx: ActionContext) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session.state) return { ok: false, error: persistenceProblem(session.persistence)! };
  try {
    const result = (await fn({ ...(await catalogContext()), state: session.state, session })) ?? {
      ok: true,
    };
    if (result.ok) {
      revalidatePath("/", "layout");
    }
    return result;
  } catch (e) {
    if (e instanceof BuyerStateError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export const str = (v: unknown) => (typeof v === "string" ? v : "");
