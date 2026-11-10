// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import type { OptimizeResponse } from "../optimizer/types";
import { AGENT_MODEL, runAgent, runScripted, scriptedSummary } from "./agent";
import type { Toolbox, ToolOutcome } from "./tools";
import type { AutopilotEvent, StepTool } from "./types";

const ctx = { buyerName: "Third Shift Coffee (Demo)", buyerKind: "cafe", today: "2026-11-05" };

const response = (over: Partial<OptimizeResponse> = {}) =>
  ({
    status: "optimal",
    recommendation: {
      total_cents: 120300,
      items_subtotal_cents: 120300,
      fees_cents: 0,
      supplier_count: 1,
      suppliers: [{ supplier_id: "sup_kestrel", supplier_name: "Kestrel Foodservice (Demo)" }],
      lines: [],
    },
    savings_cents: 4720,
    explanations: ["Kestrel waives delivery over $500."],
    problems: [],
    ...over,
  }) as unknown as OptimizeResponse;

/** A Toolbox that records calls and never touches a database. */
function fakeTools(opts: { failPrice?: boolean; quote?: string | null } = {}) {
  const calls: string[] = [];
  let priced: ReturnType<Toolbox["lastPriced"]> = null;
  const done = new Set<StepTool>();
  const ok = (tool: StepTool, detail: string, forAgent: unknown = {}): ToolOutcome => {
    done.add(tool);
    return { ok: true, forAgent, detail };
  };
  const tools: Toolbox = {
    done,
    async checkStock() {
      calls.push("check_stock");
      return ok("check_stock", "12 items to order", { planned_for: "2026-11-06" });
    },
    async draftOrder(input) {
      calls.push(`draft_order:${input.delivery_date}:${input.remove_product_ids.join(",")}`);
      return ok("draft_order", "12 items for Fri, Nov 6");
    },
    async checkVendorQuotes() {
      calls.push("check_vendor_quotes");
      return ok("check_vendor_quotes", "No current quotes for these items");
    },
    async priceOrder() {
      calls.push("price_order");
      if (opts.failPrice) throw new Error("optimizer exploded");
      priced = { runId: "run-1", response: response(), deliveryDate: "2026-11-06" };
      return ok("price_order", "$1,203.00 from 1 supplier", { status: "optimal" });
    },
    plannedDate: () => (done.has("check_stock") ? "2026-11-06" : null),
    lastPriced: () => priced,
    quoteHighlight: () => opts.quote ?? null,
  };
  return { tools, calls };
}

type Block = Record<string, unknown>;
const toolUse = (id: string, name: string, input: Block = {}): Block => ({
  type: "tool_use",
  id,
  name,
  input,
});
const turn = (...content: Block[]) => ({ stop_reason: "tool_use", content });

/** A stand-in for the SDK that plays the given turns in order. */
function fakeClient(turns: (() => unknown)[]) {
  const create = vi.fn(async () => {
    const next = turns.shift();
    if (!next) throw new Error("no more turns");
    return next();
  });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

/** The user message that carried these tool results (the loop reuses one messages array). */
function resultsFor(messages: { role: string; content: unknown }[], ids: string[]) {
  return messages.find(
    (m) =>
      m.role === "user" &&
      Array.isArray(m.content) &&
      (m.content as Block[]).some(
        (b) => b.type === "tool_result" && ids.includes(b.tool_use_id as string),
      ),
  ) as { role: string; content: Block[] } | undefined;
}

function collect() {
  const events: AutopilotEvent[] = [];
  return { events, emit: (e: AutopilotEvent) => events.push(e) };
}

describe("Autopilot with Claude", () => {
  it("runs the tools Claude picks, in parallel when asked, and stops at present_plan", async () => {
    const { tools, calls } = fakeTools();
    const { events, emit } = collect();
    const { client, create } = fakeClient([
      () => turn({ type: "text", text: "Checking the pantry." }, toolUse("t1", "check_stock")),
      () =>
        turn(toolUse("t2", "draft_order", { delivery_date: "2026-11-06", remove_product_ids: [] })),
      () => turn(toolUse("t3", "check_vendor_quotes"), toolUse("t4", "price_order")),
      () =>
        turn(
          toolUse("t5", "present_plan", {
            headline: "Friday's order is ready:   one supplier",
            notes: ["One.", "Two.", "Three.", "Four is too many."],
          }),
        ),
    ]);

    const result = await runAgent(tools, emit, ctx, client);

    expect(calls).toEqual([
      "check_stock",
      "draft_order:2026-11-06:",
      "check_vendor_quotes",
      "price_order",
    ]);
    expect(result).toEqual({
      headline: "Friday's order is ready: one supplier",
      notes: ["One.", "Two.", "Three."],
    });
    expect(events.filter((e) => e.type === "note")).toEqual([
      { type: "note", text: "Checking the pantry." },
    ]);
    expect(
      events
        .filter((e) => e.type === "step" && e.status !== "running")
        .map((e) => e.type === "step" && e.tool),
    ).toEqual(["check_stock", "draft_order", "check_vendor_quotes", "price_order", "present_plan"]);

    // Every request: the latest model, catalog-clock date, no forced tool choice; both parallel
    // results go back in ONE user message, matched to their tool_use ids.
    const params = create.mock.calls.map((c) => (c as unknown as [Record<string, never>])[0]);
    expect(params.every((p) => p.model === AGENT_MODEL && !("tool_choice" in p))).toBe(true);
    expect(AGENT_MODEL).toBe("claude-opus-5-5");
    expect(JSON.stringify(params[0]!.system)).toContain("Today is 2026-11-05");
    const results = resultsFor(params[3]!.messages, ["t3", "t4"])!;
    expect(results.content.map((b) => b.tool_use_id)).toEqual(["t3", "t4"]);
  });

  it("returns tool failures to Claude as errors instead of crashing", async () => {
    const { tools } = fakeTools({ failPrice: true });
    const { events, emit } = collect();
    const { client, create } = fakeClient([
      () => turn(toolUse("t1", "price_order")),
      () => turn(toolUse("t2", "present_plan", { headline: "Couldn't price it", notes: [] })),
    ]);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await runAgent(tools, emit, ctx, client);
    quiet.mockRestore();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "step", tool: "price_order", status: "error" }),
    );
    const sent = (
      create.mock.calls[1] as unknown as [{ messages: { role: string; content: unknown }[] }]
    )[0];
    expect(resultsFor(sent.messages, ["t1"])!.content[0]).toMatchObject({
      tool_use_id: "t1",
      is_error: true,
    });
  });

  it("finishes with the standard steps if Claude fails mid-run", async () => {
    const { tools, calls } = fakeTools({ quote: null });
    const { events, emit } = collect();
    const { client } = fakeClient([
      () => turn(toolUse("t1", "check_stock")),
      () => {
        throw new Anthropic.APIConnectionError({ message: "offline" });
      },
    ]);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAgent(tools, emit, ctx, client);
    quiet.mockRestore();
    // check_stock isn't repeated; the rest run in order.
    expect(calls).toEqual([
      "check_stock",
      "draft_order:2026-11-06:",
      "check_vendor_quotes",
      "price_order",
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "note", text: expect.stringMatching(/standard steps/) }),
    );
    expect(result.headline).toBe("Friday's order is ready: 1 supplier, $1,203.00");
  });

  it("nudges once when Claude stops without presenting, then finishes itself", async () => {
    const { tools } = fakeTools();
    const { emit } = collect();
    const { client, create } = fakeClient([
      () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "Done?" }] }),
      () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "Still done." }] }),
    ]);
    const result = await runAgent(tools, emit, ctx, client);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.headline).toMatch(/order is ready/);
  });

  it("caps how many times Claude can re-price", async () => {
    const { tools, calls } = fakeTools();
    const { emit } = collect();
    const { client } = fakeClient([
      ...Array.from({ length: 4 }, (_, i) => () => turn(toolUse(`p${i}`, "price_order"))),
      () => turn(toolUse("done", "present_plan", { headline: "Ok", notes: [] })),
    ]);
    await runAgent(tools, emit, ctx, client);
    expect(calls.filter((c) => c === "price_order")).toHaveLength(3);
  });
});

describe("Autopilot without AI", () => {
  it("runs the fixed steps and summarizes from the stored numbers only", async () => {
    const { tools, calls } = fakeTools({ quote: "Your Bramblewood quote is 21% under catalog." });
    const { events, emit } = collect();
    const result = await runScripted(tools, emit);
    expect(calls).toEqual([
      "check_stock",
      "draft_order:2026-11-06:",
      "check_vendor_quotes",
      "price_order",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "step", tool: "present_plan", status: "done" });
    expect(result).toEqual({
      headline: "Friday's order is ready: 1 supplier, $1,203.00",
      notes: [
        "Saves $47.20 against your usual suppliers.",
        "Kestrel waives delivery over $500.",
        "Your Bramblewood quote is 21% under catalog.",
      ],
    });
  });

  it("says plainly when nothing could be priced", () => {
    const { tools } = fakeTools();
    expect(scriptedSummary(tools).headline).toBe("No delivery dates available");
  });
});
