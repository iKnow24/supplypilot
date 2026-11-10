/**
 * Autopilot: one tap plans the next order. Shared by the server (agent, stream) and the
 * Home screen that shows each step live.
 */

export const STEP_TOOLS = [
  "check_stock",
  "draft_order",
  "check_vendor_quotes",
  "price_order",
  "present_plan",
] as const;
export type StepTool = (typeof STEP_TOOLS)[number];

export const STEP_TITLE: Record<StepTool, string> = {
  check_stock: "Checking your pantry",
  draft_order: "Drafting the order",
  check_vendor_quotes: "Checking your vendor quotes",
  price_order: "Pricing it across every supplier",
  present_plan: "Laying out the plan",
};

/** What the server streams to the browser, one JSON object per line. */
export type AutopilotEvent =
  | { type: "start"; autopilotId: string; usedAi: boolean; notice: string | null }
  /** Waiting on Claude to decide the next step. */
  | { type: "thinking" }
  | { type: "step"; id: string; tool: StepTool; status: "running" }
  | { type: "step"; id: string; tool: StepTool; status: "done" | "error"; detail: string }
  /** A short line from the agent between steps. */
  | { type: "note"; text: string }
  | { type: "plan"; plan: AutopilotPlan }
  | { type: "error"; message: string };

export interface AutopilotPlan {
  autopilotId: string;
  usedAi: boolean;
  /** The Find My Best Price result it produced, if pricing ran. */
  runId: string | null;
  deliveryDate: string | null;
  status: "optimal" | "partial" | "infeasible" | null;
  headline: string;
  /** The agent's short notes. Totals below come from the stored result, never from these. */
  notes: string[];
  totalCents: number | null;
  savingsCents: number | null;
  suppliers: { id: string; name: string; totalCents: number; itemCount: number }[];
  itemCount: number;
  /** Items no supplier could fill. */
  leftOut: string[];
  /** Draft POs already created from this plan (after the buyer approved). */
  purchaseOrderCount: number;
  createdAt: string;
}
