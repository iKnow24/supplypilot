import { CircleCheck, Clock, FileText, Package, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function Tile({
  title,
  body,
  visual,
  className,
}: {
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "landing-card reveal flex flex-col overflow-hidden rounded-2xl transition-colors",
        className,
      )}
    >
      <div className="relative flex min-h-48 flex-1 items-center justify-center px-6 pt-6">
        {visual}
      </div>
      <div className="p-6 pt-5">
        <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--l-muted)]">{body}</p>
      </div>
    </li>
  );
}

/** Each visual is decorative and uses numbers from the real demo scenarios. */
function BasketBars() {
  const rows = [
    // Widths are share of $160; static classes because the CSP forbids inline styles.
    { name: "Meadowlark", total: "132.60", itemsW: "w-[73.5%]", feeW: "w-[9.4%]", best: true },
    { name: "Pelican", total: "150.90", itemsW: "w-[66.2%]", feeW: "w-[28.1%]", best: false },
  ];
  return (
    <div aria-hidden className="w-full max-w-md space-y-4">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-white">
              {r.name}
              {r.best ? (
                <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300">
                  Best delivered
                </span>
              ) : null}
            </span>
            <span className="tabular text-zinc-300">${r.total}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={cn(r.itemsW, r.best ? "bg-emerald-400" : "bg-zinc-400")} />
            <div className={cn(r.feeW, r.best ? "bg-emerald-400/45" : "bg-rose-400/70")} />
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-zinc-400" /> Items
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose-400/70" /> Delivery fee
        </span>
      </div>
    </div>
  );
}

function WeekStrip() {
  const days = [
    ["Mon", 3],
    ["Tue", 3],
    ["Wed", 4],
    ["Thu", 3],
    ["Fri", 4],
    ["Sat", 2],
    ["Sun", 0],
  ] as const;
  return (
    <div aria-hidden className="grid w-full max-w-xs grid-cols-7 gap-1.5">
      {days.map(([d, n]) => (
        <div
          key={d}
          className={cn(
            "flex flex-col items-center rounded-lg border py-2 text-[10px]",
            d === "Wed"
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
              : n === 0
                ? "border-white/5 text-zinc-500"
                : "border-white/10 text-zinc-300",
          )}
        >
          <span className="uppercase">{d}</span>
          <span className="tabular mt-1 text-sm font-semibold">{n || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function FreshnessList() {
  const rows = [
    { what: "Kestrel · espresso price", age: "2 days", ok: true },
    { what: "Pelican · espresso price", age: "38 days", ok: false },
    { what: "Citrus Row · blueberry stock", age: "75 hours", ok: false },
  ];
  return (
    <ul aria-hidden className="w-full max-w-xs space-y-2 text-xs">
      {rows.map((r) => (
        <li
          key={r.what}
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          {r.ok ? (
            <CircleCheck className="size-3.5 text-emerald-300" />
          ) : (
            <X className="size-3.5 text-rose-300" />
          )}
          <span className="flex-1 text-zinc-200">{r.what}</span>
          <span className={cn("tabular", r.ok ? "text-zinc-400" : "text-rose-300")}>{r.age}</span>
        </li>
      ))}
    </ul>
  );
}

function WhyList() {
  return (
    <div
      aria-hidden
      className="w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-zinc-300"
    >
      <p className="mb-2 font-medium text-white">Why this plan</p>
      <ul className="space-y-1.5">
        <li className="flex gap-2">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-300" />
          Bramblewood delivers free because the order passes its $500 threshold.
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-300" />
          Strawberries left out: Citrus Row&apos;s $75 minimum can&apos;t be reached with 16 lb.
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-300" />
          Your usual suppliers are already the cheapest for this order.
        </li>
      </ul>
    </div>
  );
}

function PackRound() {
  return (
    <div aria-hidden className="flex items-center gap-3 text-center">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[10px] text-zinc-400 uppercase">You asked</p>
        <p className="tabular mt-1 text-xl font-semibold text-white">64 fl oz</p>
      </div>
      <Package className="size-4 text-zinc-500" />
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3">
        <p className="text-[10px] text-emerald-200/80 uppercase">1 gal jug</p>
        <p className="tabular mt-1 text-xl font-semibold text-white">128 fl oz</p>
      </div>
    </div>
  );
}

function PoDoc() {
  return (
    <div aria-hidden className="relative w-full max-w-sm">
      <div className="absolute inset-x-6 -top-3 h-full rotate-[-3deg] rounded-xl border border-white/10 bg-white/[0.03]" />
      <div className="relative rounded-xl bg-white p-4 text-[11px] text-zinc-800 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-semibold">
            <FileText className="size-3.5 text-emerald-700" /> PO THI-261109-001
          </p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            Exported
          </span>
        </div>
        <div className="mt-3 space-y-1 text-zinc-600">
          <div className="flex justify-between">
            <span>MDC-MK-W4 · Whole milk × 4</span>
            <span className="tabular">$75.60</span>
          </div>
          <div className="flex justify-between">
            <span>MDC-PL-OAT12 · Oat milk × 1</span>
            <span className="tabular">$42.00</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold text-zinc-900">
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> Order by Tue, 6 PM
            </span>
            <span className="tabular">$132.60</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Bento() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      <Tile
        className="md:col-span-2"
        title="The cheapest items aren't the cheapest order"
        body="Delivery fees, minimums and free-delivery thresholds change the answer. SupplyPilot prices the whole delivered order, not item by item."
        visual={<BasketBars />}
      />
      <Tile
        title="Knows every delivery day"
        body="Pick a date and see who can deliver, with each supplier's cutoff and the reason when they can't."
        visual={<WeekStrip />}
      />
      <Tile
        title="Never uses stale data"
        body="Prices and stock counts past their freshness limit are left out, and the plan says so."
        visual={<FreshnessList />}
      />
      <Tile
        className="md:col-span-2"
        title="Explains every decision in plain English"
        body="Why this supplier, why that item was left out, why delivery is free. No black box, and no invented savings."
        visual={<WhyList />}
      />
      <Tile
        title="Pack sizes, normalized"
        body="Ask in pounds, quarts or each. Orders round up to real packs and show you exactly how much extra."
        visual={<PackRound />}
      />
      <Tile
        className="md:col-span-2"
        title="Purchase orders in one click"
        body="Approve the plan and get a draft PO per supplier with SKUs, pack prices and cutoffs. Download a PDF or CSV and send it yourself."
        visual={<PoDoc />}
      />
    </ul>
  );
}
