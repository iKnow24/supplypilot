/**
 * POST /home/autopilot: runs Autopilot for the signed-in buyer and streams each step as
 * newline-delimited JSON (see lib/autopilot/types.ts). It drafts and prices the order and
 * stops there: creating POs is a separate, explicit tap.
 *
 * Same-origin only (route handlers don't get server actions' built-in CSRF check). Claude is
 * used when ANTHROPIC_API_KEY is set and the org is under AUTOPILOT_AI_RUNS_PER_HOUR;
 * otherwise the same tools run as a fixed script, and the screen says so.
 */
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { runAgent, runScripted, type AgentResult } from "@/lib/autopilot/agent";
import { loadAutopilotPlan } from "@/lib/autopilot/plan";
import { AutopilotTools } from "@/lib/autopilot/tools";
import type { AutopilotEvent } from "@/lib/autopilot/types";
import { BuyerStateError } from "@/lib/buyer-state/repository";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession, persistenceProblem } from "@/lib/session";
import { aiConfigured } from "@/lib/vendor-prices/extract";
import { localDay } from "@/lib/vendor-prices/parse";

export const maxDuration = 300;

const AI_RUNS_PER_HOUR = () => Number(process.env.AUTOPILOT_AI_RUNS_PER_HOUR) || 10;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const session = await getSession();
  if (!session.state) {
    return Response.json({ error: persistenceProblem(session.persistence) }, { status: 401 });
  }
  const state = session.state;

  let useAi = aiConfigured();
  let notice: string | null = useAi
    ? null
    : "AI is off on this server, so Autopilot runs its standard steps.";
  let autopilotId: string;
  try {
    if (useAi && (await state.countRecentAiAutopilotRuns()) >= AI_RUNS_PER_HOUR()) {
      useAi = false;
      notice = "You've used Claude a lot this hour, so Autopilot runs its standard steps.";
    }
    autopilotId = await state.startAutopilotRun(useAi);
  } catch (e) {
    const message = e instanceof BuyerStateError ? e.message : "Couldn't start Autopilot.";
    return Response.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AutopilotEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away; keep working so the run is still saved.
        }
      };
      emit({ type: "start", autopilotId, usedAi: useAi, notice });

      const tools = new AutopilotTools({ ...session, state });
      const source = await getRepository().source();
      let result: AgentResult | null = null;
      let failure: string | null = null;
      try {
        result = useAi
          ? await runAgent(
              tools,
              emit,
              {
                buyerName: session.buyer.name,
                buyerKind: session.buyer.kind,
                // The catalog's clock: fixed for the synthetic demo, so dates line up with it.
                today: localDay(source.now),
              },
              new Anthropic({ maxRetries: 1, timeout: 90_000 }),
            )
          : await runScripted(tools, emit);
      } catch (e) {
        console.error("autopilot: run failed", e);
        failure = "Autopilot hit a problem. Your cart may have changed; check it before ordering.";
      }

      const priced = tools.lastPriced();
      try {
        await state.finishAutopilotRun(autopilotId, {
          status: failure ? "failed" : "planned",
          deliveryDate: priced?.deliveryDate ?? tools.plannedDate(),
          optimizationRunId: priced?.runId ?? null,
          headline: result?.headline ?? null,
          notes: result?.notes ?? [],
          error: failure,
        });
        const record = await state.latestAutopilotRun();
        if (record && record.id === autopilotId) {
          emit({ type: "plan", plan: await loadAutopilotPlan(state, record) });
        } else if (failure) {
          emit({ type: "error", message: failure });
        }
      } catch (e) {
        console.error("autopilot: couldn't save the run", e);
        emit({ type: "error", message: failure ?? "Couldn't save the plan. Please try again." });
      }
      revalidatePath("/", "layout");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
