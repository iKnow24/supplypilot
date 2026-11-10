/**
 * Autopilot runs against the LOCAL Supabase stack (make db-start): org-scoped, can't point at
 * another org's result, and never deleted by buyers. Run: npm run test:db
 */
// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { DEMO_PASSWORD, demoEmail } from "../auth/demo-users";
import type { Database } from "../db/database.types";
import type { OptimizeRequest, OptimizeResponse } from "../optimizer/types";
import { SupabaseBuyerStateRepository } from "./supabase-repository";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL/_PUBLISHABLE_KEY (make db-env)");

type Db = SupabaseClient<Database>;
const client = (): Db => createClient<Database>(url, key, { auth: { persistSession: false } });

async function signedIn(org: string): Promise<Db> {
  const db = client();
  const { error } = await db.auth.signInWithPassword({
    email: demoEmail(org),
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`demo sign-in failed for ${org}: ${error.message}`);
  return db;
}

const A = "org_thirdshift";
const B = "org_littlejuniper";
let a: Db;
let b: Db;
let repoA: SupabaseBuyerStateRepository;
let repoB: SupabaseBuyerStateRepository;

const request = {
  buyer_id: B,
  zone: "ORL-WP",
  delivery_date: "2026-11-10",
  lines: [{ product_id: "prd_onion_yellow", quantity: "10", unit: "lb" }],
} as unknown as OptimizeRequest;
const infeasible = {
  status: "infeasible",
  recommendation: null,
  problems: [],
  savings_cents: null,
} as unknown as OptimizeResponse;

beforeAll(async () => {
  [a, b] = await Promise.all([signedIn(A), signedIn(B)]);
  repoA = new SupabaseBuyerStateRepository(a, A);
  repoB = new SupabaseBuyerStateRepository(b, B);
});

describe("autopilot runs", () => {
  it("anonymous visitors can read and start nothing", async () => {
    const { data, error } = await client().from("autopilot_runs").select("*");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  it("start, finish and read back; AI runs are counted for the cap", async () => {
    const before = await repoA.countRecentAiAutopilotRuns();
    const id = await repoA.startAutopilotRun(true);
    expect(await repoA.countRecentAiAutopilotRuns()).toBe(before + 1);
    await repoA.startAutopilotRun(false); // scripted runs don't count
    expect(await repoA.countRecentAiAutopilotRuns()).toBe(before + 1);

    const runId = await repoA.saveRun({ ...request, buyer_id: A }, infeasible);
    await repoA.finishAutopilotRun(id, {
      status: "planned",
      deliveryDate: "2026-11-10",
      optimizationRunId: runId,
      headline: "Tuesday's order is ready",
      notes: ["One.", "Two."],
      error: null,
    });
    // The scripted run started after it is still "running", so the newest finished one is this.
    const latest = await repoA.latestAutopilotRun();
    expect(latest).toMatchObject({
      id,
      status: "planned",
      usedAi: true,
      optimizationRunId: runId,
      headline: "Tuesday's order is ready",
      notes: ["One.", "Two."],
    });
  });

  it("is invisible to other orgs, who can't finish it", async () => {
    const id = await repoA.startAutopilotRun(false);
    const { data } = await b.from("autopilot_runs").select("id").eq("id", id);
    expect(data).toEqual([]);
    const { data: changed } = await b
      .from("autopilot_runs")
      .update({ headline: "hijacked" })
      .eq("id", id)
      .select("id");
    expect(changed).toEqual([]);
    const ins = await b.from("autopilot_runs").insert({ org_id: A, used_ai: false });
    expect(ins.error?.code).toBe("42501");
  });

  it("can't point at another org's result", async () => {
    const theirs = await repoB.saveRun(request, infeasible);
    const id = await repoA.startAutopilotRun(false);
    const { error } = await a
      .from("autopilot_runs")
      .update({ optimization_run_id: theirs })
      .eq("id", id);
    expect(error?.code).toBe("23503");
  });

  it("buyers can't delete runs", async () => {
    const id = await repoA.startAutopilotRun(false);
    const { error } = await a.from("autopilot_runs").delete().eq("id", id);
    expect(error?.code).toBe("42501");
  });
});
