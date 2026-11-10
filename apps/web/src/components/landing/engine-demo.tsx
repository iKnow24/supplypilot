"use client";

import { Ban, CalendarDays, Coffee, Store, Salad, Sparkles } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/*
 * Three real demo scenarios, with the numbers the optimizer returns for them (synthetic
 * catalog, fixed demo clock). Bar widths are static classes because the CSP forbids inline
 * styles; each is the value's share of the scenario's scale.
 */
type Row = {
  name: string;
  /** e.g. "$117.60 items + $15.00 delivery" */
  detail: string;
  total?: string;
  itemsW: string;
  feeW: string;
  best?: boolean;
  blocked?: string;
};

type Mode = { label: string; rows: Row[]; verdict: string };

type Scenario = {
  id: string;
  tab: string;
  short: string;
  icon: typeof Coffee;
  buyer: string;
  basket: string[];
  control: string;
  modes: [Mode, Mode];
};

const SCENARIOS: Scenario[] = [
  {
    id: "fees",
    tab: "Delivery fees",
    short: "Fees",
    icon: Coffee,
    buyer: "Third Shift Coffee · Wed, Nov 11",
    basket: ["16 gal whole milk", "12 qt oat milk"],
    control: "Compare by",
    modes: [
      {
        label: "Item prices",
        rows: [
          {
            name: "Pelican Wholesale",
            detail: "$105.90 in items",
            total: "$105.90",
            itemsW: "w-[66.2%]",
            feeW: "w-0",
            best: true,
          },
          {
            name: "Meadowlark Dairy",
            detail: "$117.60 in items",
            total: "$117.60",
            itemsW: "w-[73.5%]",
            feeW: "w-0",
          },
        ],
        verdict: "On item prices alone, Pelican looks $11.70 cheaper.",
      },
      {
        label: "Delivered cost",
        rows: [
          {
            name: "Meadowlark Dairy",
            detail: "$117.60 items + $15.00 delivery",
            total: "$132.60",
            itemsW: "w-[73.5%]",
            feeW: "w-[9.4%]",
            best: true,
          },
          {
            name: "Pelican Wholesale",
            detail: "$105.90 items + $45.00 delivery",
            total: "$150.90",
            itemsW: "w-[66.2%]",
            feeW: "w-[28.1%]",
          },
        ],
        verdict: "Pelican's $45 delivery fee makes it $18.30 more. Meadowlark wins.",
      },
    ],
  },
  {
    id: "days",
    tab: "Delivery days",
    short: "Days",
    icon: CalendarDays,
    buyer: "Third Shift Coffee · paper goods",
    basket: ["2,000 hot cups", "2,000 lids", "1,000 cold cups", "6,000 napkins"],
    control: "Deliver on",
    modes: [
      {
        label: "Sat, Nov 14",
        rows: [
          {
            name: "Pelican Wholesale",
            detail: "$496.60 items + $45.00 delivery",
            total: "$541.60",
            itemsW: "w-[88.7%]",
            feeW: "w-[8%]",
            best: true,
          },
          {
            name: "Kestrel Restaurant Supply",
            detail: "Doesn't deliver on Saturdays",
            itemsW: "w-0",
            feeW: "w-0",
            blocked: "No Saturday delivery",
          },
        ],
        verdict: "Only Pelican delivers on Saturday, so it's $541.60.",
      },
      {
        label: "Wed, Nov 11",
        rows: [
          {
            name: "Kestrel Restaurant Supply",
            detail: "$454.30 items + $35.00 delivery",
            total: "$489.30",
            itemsW: "w-[81.1%]",
            feeW: "w-[6.3%]",
            best: true,
          },
          {
            name: "Pelican Wholesale",
            detail: "$496.60 items + $45.00 delivery",
            total: "$541.60",
            itemsW: "w-[88.7%]",
            feeW: "w-[8%]",
          },
        ],
        verdict: "Move it to Wednesday and Kestrel can deliver: $52.30 less.",
      },
    ],
  },
  {
    id: "minimums",
    tab: "Order minimums",
    short: "Minimums",
    icon: Salad,
    buyer: "Little Juniper · Mon, Nov 9",
    basket: ["100 lb yellow onions", "25 lb Roma tomatoes"],
    control: "Compare by",
    modes: [
      {
        label: "Item prices",
        rows: [
          {
            name: "Kestrel Restaurant Supply",
            detail: "About $88.30 in items",
            total: "$88.30",
            itemsW: "w-[21%]",
            feeW: "w-0",
            best: true,
          },
          {
            name: "Citrus Row Produce",
            detail: "$93.70 in items",
            total: "$93.70",
            itemsW: "w-[22.3%]",
            feeW: "w-0",
          },
        ],
        verdict: "Kestrel has the lowest item prices.",
      },
      {
        label: "Delivered cost",
        rows: [
          {
            name: "Citrus Row Produce",
            detail: "$93.70 items + $20.00 delivery · $75 minimum met",
            total: "$113.70",
            itemsW: "w-[22.3%]",
            feeW: "w-[4.8%]",
            best: true,
          },
          {
            name: "Kestrel Restaurant Supply",
            detail: "$88.30 is below its $400.00 minimum",
            itemsW: "w-[21%]",
            feeW: "w-0",
            blocked: "Below minimum",
          },
        ],
        verdict: "Kestrel can't take an $88 order. Citrus Row it is, with the reason shown.",
      },
    ],
  },
];

export function EngineDemo() {
  const [active, setActive] = useState(0);
  const [modes, setModes] = useState<number[]>(() => SCENARIOS.map(() => 0));
  const uid = useId();
  const scenario = SCENARIOS[active]!;
  const modeIndex = modes[active]!;
  const mode = scenario.modes[modeIndex]!;

  const setMode = (m: number) => setModes((prev) => prev.map((v, i) => (i === active ? m : v)));

  return (
    <div className="glow-border rounded-3xl">
      <div className="overflow-hidden rounded-3xl bg-[oklch(0.175_0.007_250)]">
        {/* tabs */}
        <div
          role="tablist"
          aria-label="Scenarios"
          className="flex gap-1 overflow-x-auto border-b border-white/[0.07] p-2"
        >
          {SCENARIOS.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${s.id}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const next =
                    (i + (e.key === "ArrowRight" ? 1 : -1) + SCENARIOS.length) % SCENARIOS.length;
                  setActive(next);
                  document.getElementById(`${uid}-tab-${SCENARIOS[next]!.id}`)?.focus();
                }}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                )}
              >
                <s.icon
                  className={cn("size-4", selected ? "text-emerald-300" : "text-zinc-500")}
                  aria-hidden
                />
                <span className="sm:hidden">{s.short}</span>
                <span className="max-sm:hidden">{s.tab}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel`}
          aria-labelledby={`${uid}-tab-${scenario.id}`}
          className="grid gap-0 lg:grid-cols-[0.85fr_1.4fr]"
        >
          {/* the order */}
          <div className="border-white/[0.07] p-6 max-lg:border-b sm:p-8 lg:border-r">
            <p className="text-xs font-medium tracking-[0.14em] text-zinc-400 uppercase">
              The order
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-white">
              <Store className="size-4 text-emerald-300" aria-hidden />
              {scenario.buyer}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {scenario.basket.map((b) => (
                <li
                  key={b}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300"
                >
                  {b}
                </li>
              ))}
            </ul>

            <p
              id={`${uid}-control`}
              className="mt-8 text-xs font-medium tracking-[0.14em] text-zinc-400 uppercase"
            >
              {scenario.control}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={`${uid}-control`}
              className="mt-3 inline-flex rounded-full border border-white/10 bg-black/20 p-1"
            >
              {scenario.modes.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  role="radio"
                  aria-checked={i === modeIndex}
                  onClick={() => setMode(i)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                    i === modeIndex
                      ? "bg-white text-zinc-950 shadow-[0_4px_20px_-4px_oklch(0.8_0.15_163/0.6)]"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-8 hidden text-xs leading-relaxed text-zinc-400 lg:block">
              Real output from the SupplyPilot optimizer on the demo catalog. Fictional suppliers,
              fixed demo clock.
            </p>
          </div>

          {/* the answer */}
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-medium tracking-[0.14em] text-zinc-400 uppercase">
                The answer
              </p>
              <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                <Sparkles className="size-3.5" aria-hidden /> Solved exactly
              </p>
            </div>
            <ol className="mt-5 space-y-5">
              {mode.rows.map((r) => (
                <li key={r.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium text-white">
                      {r.name}
                      {r.best ? (
                        <span className="ml-2 inline-block rounded-full bg-emerald-400/15 px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-emerald-300 uppercase">
                          {mode.label === "Item prices" ? "Looks cheapest" : "Best"}
                        </span>
                      ) : null}
                      {r.blocked ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-rose-300 uppercase">
                          <Ban className="size-3" aria-hidden /> {r.blocked}
                        </span>
                      ) : null}
                    </p>
                    <p
                      className={cn(
                        "tabular shrink-0 text-lg font-semibold tracking-tight",
                        r.blocked ? "text-zinc-400 line-through" : "text-white",
                      )}
                    >
                      {r.total ?? "—"}
                    </p>
                  </div>
                  <div
                    aria-hidden
                    className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/[0.05]"
                  >
                    <div
                      className={cn(
                        "h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        r.itemsW,
                        r.blocked
                          ? "bg-zinc-600/60"
                          : r.best
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                            : "bg-zinc-400",
                      )}
                    />
                    <div
                      className={cn(
                        "h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        r.feeW,
                        r.best ? "bg-emerald-300/40" : "bg-rose-400/80",
                      )}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-400">{r.detail}</p>
                </li>
              ))}
            </ol>
            <div
              aria-live="polite"
              className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-200"
            >
              {mode.verdict}
            </div>
            <div aria-hidden className="mt-4 flex gap-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-zinc-400" /> Items
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-400/80" /> Delivery fee
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
