"use client";

import { Ban, Check, Store } from "lucide-react";
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
  photo: string;
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
    photo: "/landing/milk.jpg",
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
    photo: "/landing/po-box.jpg",
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
    photo: "/landing/produce-crate.jpg",
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
    <div className="paper overflow-hidden rounded-[1.75rem]">
      {/* tabs: one per scenario, each with its photo */}
      <div
        role="tablist"
        aria-label="Scenarios"
        className="bg-sand/60 border-ink/10 grid grid-cols-3 gap-1.5 border-b p-2 sm:gap-2 sm:p-3"
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
                "flex items-center gap-3 rounded-2xl p-1.5 pr-3 text-left text-sm font-semibold transition-all max-sm:flex-col max-sm:pr-1.5 max-sm:text-center",
                selected
                  ? "text-ink ring-ink/10 bg-white shadow-[0_6px_20px_-8px_oklch(0.3_0.04_70/0.35)] ring-1"
                  : "text-ink-soft hover:text-ink hover:bg-white/60",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- plain img: next/image adds inline styles the CSP blocks */}
              <img
                src={s.photo}
                alt=""
                width={96}
                height={64}
                className="h-12 w-16 shrink-0 rounded-xl object-cover max-sm:h-14 max-sm:w-full"
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
        className="grid lg:grid-cols-[0.85fr_1.4fr]"
      >
        {/* the order */}
        <div className="border-ink/10 p-6 max-lg:border-b sm:p-8 lg:border-r">
          <p className="text-ink-soft text-xs font-semibold tracking-[0.14em] uppercase">
            The order
          </p>
          <p className="text-ink mt-3 flex items-center gap-2 text-sm font-semibold">
            <Store className="text-navy size-4" aria-hidden />
            {scenario.buyer}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {scenario.basket.map((b) => (
              <li
                key={b}
                className="border-ink/10 bg-cream text-ink rounded-lg border px-2.5 py-1 text-xs font-medium"
              >
                {b}
              </li>
            ))}
          </ul>

          <p
            id={`${uid}-control`}
            className="text-ink-soft mt-8 text-xs font-semibold tracking-[0.14em] uppercase"
          >
            {scenario.control}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${uid}-control`}
            className="bg-sand mt-3 inline-flex rounded-full p-1"
          >
            {scenario.modes.map((m, i) => (
              <button
                key={m.label}
                type="button"
                role="radio"
                aria-checked={i === modeIndex}
                onClick={() => setMode(i)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                  i === modeIndex
                    ? "bg-navy text-white shadow-[0_4px_14px_-4px_oklch(0.3_0.065_262/0.55)]"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-ink-soft mt-8 hidden text-xs leading-relaxed lg:block">
            Real output from the SupplyPilot optimizer on the demo catalog. Fictional suppliers,
            fixed demo clock.
          </p>
        </div>

        {/* the answer */}
        <div className="p-6 sm:p-8">
          <p className="text-ink-soft text-xs font-semibold tracking-[0.14em] uppercase">
            The answer
          </p>
          <ol className="mt-5 space-y-5">
            {mode.rows.map((r) => (
              <li key={r.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-ink min-w-0 text-sm font-semibold">
                    {r.name}
                    {r.best ? (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase",
                          mode.label === "Item prices"
                            ? "bg-butter/60 text-ink"
                            : "bg-mist text-navy-deep",
                        )}
                      >
                        {mode.label === "Item prices" ? (
                          "Looks cheapest"
                        ) : (
                          <>
                            <Check className="size-3" aria-hidden /> Best
                          </>
                        )}
                      </span>
                    ) : null}
                    {r.blocked ? (
                      <span className="bg-tomato/10 text-tomato ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase">
                        <Ban className="size-3" aria-hidden /> {r.blocked}
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={cn(
                      "tabular font-display shrink-0 text-2xl font-semibold",
                      r.blocked ? "text-ink-soft line-through" : "text-ink",
                    )}
                  >
                    {r.total ?? "—"}
                  </p>
                </div>
                <div aria-hidden className="bg-sand mt-2 flex h-3.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      r.itemsW,
                      r.blocked ? "bg-kraft" : r.best ? "bg-navy" : "bg-ink-soft/50",
                    )}
                  />
                  <div
                    className={cn(
                      "h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      r.feeW,
                      r.best ? "bg-navy/45" : "bg-tomato",
                    )}
                  />
                </div>
                <p className="text-ink-soft mt-1.5 text-xs">{r.detail}</p>
              </li>
            ))}
          </ol>
          <div
            aria-live="polite"
            className="bg-mist/70 text-navy-deep mt-6 rounded-2xl px-4 py-3 text-sm leading-relaxed font-semibold"
          >
            {mode.verdict}
          </div>
          <div aria-hidden className="text-ink-soft mt-4 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="bg-ink-soft/50 size-2 rounded-full" /> Items
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-tomato size-2 rounded-full" /> Delivery fee
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
