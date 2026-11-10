"use client";

import {
  ArrowRight,
  Check,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { approveResult } from "@/app/(app)/orders/actions";
import { useAction } from "@/components/cart/status";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  STEP_TITLE,
  type AutopilotEvent,
  type AutopilotPlan,
  type StepTool,
} from "@/lib/autopilot/types";

type Item =
  | {
      kind: "step";
      id: string;
      tool: StepTool;
      status: "running" | "done" | "error";
      detail?: string;
    }
  | { kind: "note"; id: string; text: string };

type Phase = "idle" | "running" | "done" | "error";

/** Counts up to `target` once when `animate` is on (instantly if motion is reduced). */
function useCountUp(target: number, animate: boolean, ms = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, ms]);
  return animate ? value : target;
}

function StepIcon({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running") {
    return (
      <span className="relative flex size-7 shrink-0 items-center justify-center">
        <span className="working-ring absolute inset-0" aria-hidden />
        <span className="bg-primary size-1.5 rounded-full" aria-hidden />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="bg-warning-soft text-warning animate-pop flex size-7 shrink-0 items-center justify-center rounded-full">
        <TriangleAlert className="size-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span className="bg-level-ok text-primary-foreground animate-pop flex size-7 shrink-0 items-center justify-center rounded-full">
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
        <path
          d="M3.5 8.5l3 3 6-7"
          pathLength={1}
          className="draw-path"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Timeline({ items, thinking }: { items: Item[]; thinking: boolean }) {
  return (
    <div role="log" aria-live="polite" aria-label="Autopilot steps">
      <ol className="relative space-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1 && !thinking;
          if (item.kind === "note") {
            return (
              <li key={item.id} className="animate-fade-up flex gap-3 py-1.5 pl-1">
                <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="text-muted-foreground text-sm italic">{item.text}</p>
              </li>
            );
          }
          return (
            <li key={item.id} className="animate-fade-up relative flex gap-3 pb-3">
              {!last ? (
                <span
                  aria-hidden
                  className="bg-border animate-grow-y absolute top-8 bottom-0 left-3.5 w-px origin-top"
                />
              ) : null}
              <StepIcon status={item.status} />
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn("text-sm font-medium", item.status === "running" && "text-working")}
                >
                  {STEP_TITLE[item.tool]}
                  {item.status === "running" ? "…" : ""}
                </p>
                {item.detail ? (
                  <p
                    className={cn(
                      "animate-fade-in mt-0.5 text-sm",
                      item.status === "error" ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {item.detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
        {thinking ? (
          <li className="animate-fade-in flex items-center gap-3 pb-1">
            <span className="relative flex size-7 shrink-0 items-center justify-center">
              <Sparkles className="text-primary size-4 animate-pulse" aria-hidden />
            </span>
            <p className="text-working text-sm font-medium">Deciding the next step…</p>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function PlanCard({
  plan,
  fresh,
  onRunAgain,
}: {
  plan: AutopilotPlan;
  fresh: boolean;
  onRunAgain: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [approved, setApproved] = useState(plan.purchaseOrderCount > 0);
  const total = useCountUp(plan.totalCents ?? 0, fresh);
  const max = Math.max(1, ...plan.suppliers.map((s) => s.totalCents));
  const n = plan.suppliers.length;

  return (
    <div className="animate-fade-up space-y-5">
      <h3 className="font-display text-xl font-medium sm:text-2xl">{plan.headline}</h3>

      {plan.totalCents !== null ? (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="font-display tabular text-4xl font-medium sm:text-5xl">
            {formatCents(total)}
          </p>
          <div className="pb-1.5 text-sm">
            <p className="text-muted-foreground">
              {plan.itemCount} item{plan.itemCount === 1 ? "" : "s"}
              {plan.deliveryDate ? ` for ${formatDate(plan.deliveryDate)}` : ""}
            </p>
            {plan.savingsCents !== null && plan.savingsCents > 0 ? (
              <p className="bg-success-soft text-success animate-pop mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Saves {formatCents(plan.savingsCents)} vs your usual suppliers
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {n > 0 ? (
        <ul className="stagger space-y-2.5" aria-label="Suppliers in this plan">
          {plan.suppliers.map((s) => (
            <li key={s.id} className="bg-card/80 rounded-xl p-3 ring-1 ring-black/5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="tabular font-medium">{formatCents(s.totalCents)}</span>
              </div>
              <svg
                aria-hidden
                viewBox="0 0 100 4"
                preserveAspectRatio="none"
                className="mt-2 h-1.5 w-full overflow-visible"
              >
                <rect width={100} height={4} rx={2} className="fill-muted" />
                <rect
                  width={Math.max(4, (s.totalCents / max) * 100)}
                  height={4}
                  rx={2}
                  className="fill-primary animate-grow-x origin-left [transform-box:fill-box]"
                />
              </svg>
              <p className="text-muted-foreground mt-1 text-xs">
                {s.itemCount} line{s.itemCount === 1 ? "" : "s"}, delivery included
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {plan.leftOut.length ? (
        <p className="bg-warning-soft text-warning rounded-xl px-3 py-2 text-sm">
          Left out: {plan.leftOut.join(", ")}. No supplier can fill{" "}
          {plan.leftOut.length === 1 ? "it" : "them"} for this date.
        </p>
      ) : null}

      {plan.notes.length ? (
        <ul className="space-y-1.5" aria-label="Autopilot's notes">
          {plan.notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm">
              <Sparkles className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {plan.runId && n > 0 && !approved ? (
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              run(
                () => approveResult(plan.runId!),
                (r) => {
                  if (r.ok) {
                    setApproved(true);
                    router.refresh();
                  }
                },
              )
            }
          >
            <ClipboardCheck aria-hidden /> Approve and create {n} draft PO{n === 1 ? "" : "s"}
          </Button>
        ) : null}
        {approved ? (
          <Button asChild size="lg">
            <Link href="/orders">
              <Check aria-hidden /> {n} draft PO{n === 1 ? "" : "s"} ready. Open orders{" "}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
        {plan.runId ? (
          <Button asChild size="lg" variant="outline">
            <Link href={`/results/${plan.runId}`}>See the full plan</Link>
          </Button>
        ) : null}
        <Button size="lg" variant="ghost" onClick={onRunAgain}>
          <RotateCcw aria-hidden /> Run again
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {approved
          ? "Download each PO and send it yourself. SupplyPilot never sends anything."
          : "Nothing becomes a purchase order until you approve, and nothing is ever sent to suppliers."}{" "}
        <Link href="/cart" className="underline underline-offset-2">
          Change the order
        </Link>
      </p>
    </div>
  );
}

export function Autopilot({
  initialPlan,
  deliveryDate,
  itemCount,
  shortCount,
}: {
  /** The last run's plan, if recent. */
  initialPlan: AutopilotPlan | null;
  deliveryDate: string | null;
  itemCount: number;
  shortCount: number;
}) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>(initialPlan ? "done" : "idle");
  const [items, setItems] = useState<Item[]>([]);
  const [thinking, setThinking] = useState(false);
  const [plan, setPlan] = useState<AutopilotPlan | null>(initialPlan);
  const [fresh, setFresh] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const apply = useCallback((e: AutopilotEvent) => {
    switch (e.type) {
      case "start":
        setNotice(e.notice);
        break;
      case "thinking":
        setThinking(true);
        break;
      case "note":
        setThinking(false);
        setItems((xs) => [...xs, { kind: "note", id: `n${xs.length}`, text: e.text }]);
        break;
      case "step":
        setThinking(false);
        setItems((xs) => {
          const at = xs.findIndex((x) => x.kind === "step" && x.id === e.id);
          const next: Item = {
            kind: "step",
            id: e.id,
            tool: e.tool,
            status: e.status,
            detail: e.status === "running" ? undefined : e.detail,
          };
          if (at === -1) return [...xs, next];
          const copy = [...xs];
          copy[at] = next;
          return copy;
        });
        break;
      case "plan":
        setThinking(false);
        setPlan(e.plan);
        setFresh(true);
        setPhase("done");
        break;
      case "error":
        setThinking(false);
        setError(e.message);
        setPhase("error");
        break;
    }
  }, []);

  async function start() {
    setPhase("running");
    setItems([]);
    setPlan(null);
    setError(null);
    setNotice(null);
    setThinking(true);
    headingRef.current?.focus();
    try {
      const res = await fetch("/home/autopilot", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't start Autopilot. Please try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let gotPlan = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AutopilotEvent;
          if (event.type === "plan" || event.type === "error") gotPlan = true;
          apply(event);
        }
        if (done) break;
      }
      if (!gotPlan) throw new Error("Autopilot stopped before it finished. Please try again.");
    } catch (e) {
      setThinking(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }

  const day = deliveryDate ? formatDate(deliveryDate) : null;

  return (
    <section
      id="autopilot"
      aria-labelledby={`${id}-title`}
      className="wash shadow-card animate-fade-up relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-3"
    >
      <div
        aria-hidden
        className="dots absolute inset-y-0 right-0 hidden w-1/2 [mask-image:linear-gradient(to_left,#000,transparent)] opacity-60 sm:block"
      />
      {phase === "idle" ? (
        <div
          aria-hidden
          className="animate-glow bg-primary/15 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl"
        />
      ) : null}
      <div className="relative">
        <h2
          id={`${id}-title`}
          ref={headingRef}
          tabIndex={-1}
          className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium outline-none"
        >
          <Sparkles className="text-primary size-4" aria-hidden />
          {phase === "running"
            ? `Autopilot is planning ${day ? `${day}'s` : "your"} order`
            : "Your next order"}
        </h2>

        {phase === "idle" ? (
          itemCount > 0 && day ? (
            <>
              <p className="font-display mt-2 text-3xl font-medium sm:text-[40px] sm:leading-tight">
                {itemCount} item{itemCount === 1 ? "" : "s"} for {day}
              </p>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                Autopilot checks your pantry
                {shortCount ? ` (${shortCount} run out first)` : ""}, drafts the order, checks your
                vendor quotes and prices it across every supplier. You approve before anything
                becomes a purchase order.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={start} className="w-full sm:w-auto">
                  <Sparkles aria-hidden /> Plan it for me
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/stock">Review amounts first</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display mt-2 text-3xl font-medium">Nothing to order yet</p>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                Your shelves cover the next delivery. Autopilot can still check for you.
              </p>
              <Button size="lg" variant="outline" className="mt-6" onClick={start}>
                <Sparkles aria-hidden /> Check anyway
              </Button>
            </>
          )
        ) : null}

        {phase !== "idle" ? (
          <div className="mt-5 space-y-5">
            {notice ? (
              <p className="bg-card/80 text-muted-foreground rounded-xl px-3 py-2 text-xs ring-1 ring-black/5">
                {notice}
              </p>
            ) : null}
            {phase !== "done" ? <Timeline items={items} thinking={thinking} /> : null}
            {phase === "done" && plan ? (
              <PlanCard plan={plan} fresh={fresh} onRunAgain={start} />
            ) : null}
            {phase === "done" ? (
              <details className="group border-t border-black/5 pt-4">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                  {items.length
                    ? `${items.filter((i) => i.kind === "step").length} steps · see what Autopilot did`
                    : "How Autopilot made this plan"}
                  {plan && !plan.usedAi ? " · standard steps, no AI" : ""}
                </summary>
                <div className="mt-3">
                  {items.length ? (
                    <Timeline items={items} thinking={false} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      It checked your pantry, drafted the order, compared your vendor quotes and
                      priced it across every supplier. Every number comes from those steps.
                    </p>
                  )}
                </div>
              </details>
            ) : null}
            {phase === "error" ? (
              <div className="space-y-3">
                <p
                  role="alert"
                  className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
                >
                  <X className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                </p>
                <Button variant="outline" onClick={start}>
                  <RotateCcw aria-hidden /> Try again
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
