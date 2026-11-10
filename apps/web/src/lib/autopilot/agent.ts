/**
 * Autopilot's agent loop. Claude (claude-opus-5-5) decides which tool to call next and writes
 * the short notes; the tools (tools.ts) do all the work and all the arithmetic. The loop ends
 * when Claude calls present_plan, which only describes the plan: creating POs is the buyer's tap.
 *
 * Without an AI client (no key, or over the hourly cap) the same tools run as a fixed script,
 * and if Claude fails mid-run the script finishes whatever is left.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { formatDate } from "../delivery";
import { formatCents } from "../money";
import type { Toolbox, ToolOutcome } from "./tools";
import type { AutopilotEvent, StepTool } from "./types";

export const AGENT_MODEL = "claude-opus-5-5";
const MAX_TURNS = 10;
const MAX_PRICINGS = 3;

export interface AgentContext {
  buyerName: string;
  buyerKind: string;
  today: string;
}

export interface AgentResult {
  headline: string;
  notes: string[];
}

type Emit = (event: AutopilotEvent) => void;

const SYSTEM = (
  ctx: AgentContext,
) => `You are SupplyPilot's ordering agent for ${ctx.buyerName}, an independent ${ctx.buyerKind} in Orlando. Today is ${ctx.today}. Your job: plan the order for the next delivery so the owner only has to approve it.

Use the tools, normally in this order: check_stock, draft_order (for planned_for, removing nothing), check_vendor_quotes and price_order (these two can run together), then present_plan.
- planned_for is the soonest delivery that is still bookable. Tools already check dates, order cutoffs and minimums against the catalog's clock: trust them and never work out yourself whether a date or deadline has passed.
- If price_order says some items can't be filled, you may call draft_order once more for the same date with those items removed, then price_order again, so the rest can be ordered. Say which items were left out.
- If check_stock finds nothing to order, call present_plan saying so.
- You cannot place orders, create purchase orders or contact suppliers. The owner approves the plan and creates the POs.

Writing present_plan:
- headline: one short sentence, at most 12 words, e.g. "Thursday's order is ready: two suppliers, free delivery on both".
- notes: up to 3 sentences of at most 20 words each, read in five seconds: why these suppliers, what was left out and why, and a vendor quote only if it beats the catalog.
- Only use numbers and names exactly as the tools returned them. Never estimate, round differently or invent a figure.
- Plain words. No markdown.`;

const TOOLS: BetaToolUnion[] = [
  {
    name: "check_stock",
    description:
      "Reads the pantry: what is on hand, how fast each item is used, the soonest bookable delivery date (planned_for) and how much of each item to order for it.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "draft_order",
    description:
      "Replaces the buyer's Smart Cart with the suggested order for a delivery date, optionally leaving some products out. Quantities come from the stock plan.",
    input_schema: {
      type: "object",
      properties: {
        delivery_date: { type: "string", description: "YYYY-MM-DD, one of the bookable dates" },
        remove_product_ids: {
          type: "array",
          items: { type: "string" },
          description: "Products to leave out (usually empty)",
        },
      },
      required: ["delivery_date", "remove_product_ids"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "check_vendor_quotes",
    description:
      "Compares prices the buyer added from vendor screenshots with the best catalog price for items in the draft order. Informational: pricing uses catalog prices.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "price_order",
    description:
      "Runs Find My Best Price on the drafted order: the lowest total delivered cost across all suppliers, with fees, minimums and savings against the buyer's usual suppliers. Saves the result.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "present_plan",
    description: "Ends the run by showing the priced plan to the owner. Call exactly once, last.",
    input_schema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "notes"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Runs one tool and streams its step. */
async function step(
  emit: Emit,
  tool: StepTool,
  id: string,
  call: () => Promise<ToolOutcome>,
): Promise<ToolOutcome> {
  emit({ type: "step", id, tool, status: "running" });
  let outcome: ToolOutcome;
  try {
    outcome = await call();
  } catch (e) {
    console.error(`autopilot: ${tool} failed`, e);
    outcome = { ok: false, forAgent: { error: "That step failed." }, detail: "That step failed" };
  }
  emit({ type: "step", id, tool, status: outcome.ok ? "done" : "error", detail: outcome.detail });
  return outcome;
}

/** The plan in plain words when there's no AI: built from the stored numbers only. */
export function scriptedSummary(tools: Toolbox): AgentResult {
  const priced = tools.lastPriced();
  if (!priced) {
    return {
      headline: tools.plannedDate()
        ? "Nothing to price for the next delivery"
        : "No delivery dates available",
      notes: [],
    };
  }
  const r = priced.response;
  const plan = r.recommendation;
  const day = formatDate(priced.deliveryDate, "long").split(",")[0];
  if (!plan) {
    return {
      headline: `No supplier can fill ${day}'s order`,
      notes: r.problems.slice(0, 2).map((p) => p.message),
    };
  }
  const n = plan.suppliers.length;
  const notes = [
    r.savings_cents && r.savings_cents > 0
      ? `Saves ${formatCents(r.savings_cents)} against your usual suppliers.`
      : null,
    ...r.explanations.slice(0, 2),
    tools.quoteHighlight(),
  ].filter((x): x is string => !!x);
  return {
    headline: `${day}'s order is ready: ${n} supplier${n === 1 ? "" : "s"}, ${formatCents(plan.total_cents)}`,
    notes: notes.slice(0, 3),
  };
}

/** The fixed steps, skipping any that already succeeded. */
export async function runScripted(tools: Toolbox, emit: Emit): Promise<AgentResult> {
  let n = 0;
  const id = () => `s${++n}`;
  if (!tools.done.has("check_stock")) {
    const stock = await step(emit, "check_stock", id(), () => tools.checkStock());
    if (!stock.ok) return scriptedSummary(tools);
  }
  const date = tools.plannedDate();
  if (!date) return scriptedSummary(tools);
  if (!tools.done.has("draft_order")) {
    const draft = await step(emit, "draft_order", id(), () =>
      tools.draftOrder({ delivery_date: date, remove_product_ids: [] }),
    );
    if (!draft.ok) return scriptedSummary(tools);
  }
  if (!tools.done.has("check_vendor_quotes")) {
    await step(emit, "check_vendor_quotes", id(), () => tools.checkVendorQuotes());
  }
  if (!tools.done.has("price_order")) {
    await step(emit, "price_order", id(), () => tools.priceOrder());
  }
  const summary = scriptedSummary(tools);
  emit({ type: "step", id: id(), tool: "present_plan", status: "done", detail: "Plan ready" });
  return summary;
}

/** Claude chooses the steps. Falls back to the script if the AI fails or stalls. */
export async function runAgent(
  tools: Toolbox,
  emit: Emit,
  ctx: AgentContext,
  client: Anthropic,
): Promise<AgentResult> {
  const messages: BetaMessageParam[] = [
    { role: "user", content: "Plan the order for the next delivery." },
  ];
  let pricings = 0;
  let nudged = false;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      emit({ type: "thinking" });
      const response = await client.beta.messages.create({
        model: AGENT_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM(ctx), cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      });
      if (response.stop_reason === "refusal") throw new Error("the AI declined");
      // Thinking blocks and all must go back unchanged.
      messages.push({ role: "assistant", content: response.content as BetaContentBlockParam[] });

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          emit({ type: "note", text: clean(block.text, 240) });
        }
      }
      const uses = response.content.filter((b) => b.type === "tool_use");
      if (uses.length === 0) {
        if (nudged) break;
        nudged = true;
        messages.push({ role: "user", content: "Call present_plan now to finish." });
        continue;
      }

      const results: BetaToolResultBlockParam[] = [];
      for (const use of uses) {
        const input = (use.input ?? {}) as Record<string, unknown>;
        if (use.name === "present_plan") {
          emit({
            type: "step",
            id: use.id,
            tool: "present_plan",
            status: "done",
            detail: "Plan ready",
          });
          const notes = Array.isArray(input.notes) ? input.notes : [];
          return {
            headline: clean(input.headline, 120) || scriptedSummary(tools).headline,
            notes: notes
              .map((x) => clean(x, 240))
              .filter(Boolean)
              .slice(0, 3),
          };
        }
        let outcome: ToolOutcome;
        switch (use.name) {
          case "check_stock":
            outcome = await step(emit, "check_stock", use.id, () => tools.checkStock());
            break;
          case "draft_order":
            outcome = await step(emit, "draft_order", use.id, () =>
              tools.draftOrder({
                delivery_date: clean(input.delivery_date, 10),
                remove_product_ids: Array.isArray(input.remove_product_ids)
                  ? input.remove_product_ids.filter((x): x is string => typeof x === "string")
                  : [],
              }),
            );
            break;
          case "check_vendor_quotes":
            outcome = await step(emit, "check_vendor_quotes", use.id, () =>
              tools.checkVendorQuotes(),
            );
            break;
          case "price_order":
            outcome =
              ++pricings > MAX_PRICINGS
                ? {
                    ok: false,
                    forAgent: { error: "Priced enough times. Present the plan." },
                    detail: "",
                  }
                : await step(emit, "price_order", use.id, () => tools.priceOrder());
            break;
          default:
            outcome = { ok: false, forAgent: { error: `Unknown tool ${use.name}` }, detail: "" };
        }
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(outcome.forAgent),
          ...(outcome.ok ? {} : { is_error: true }),
        });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("autopilot: the AI step failed", e instanceof Anthropic.APIError ? e.status : e);
    emit({
      type: "note",
      text: "Claude couldn't finish, so Autopilot is finishing the standard steps.",
    });
    return runScripted(tools, emit);
  }
  // Out of turns or stalled: finish what's missing with the script.
  return runScripted(tools, emit);
}
