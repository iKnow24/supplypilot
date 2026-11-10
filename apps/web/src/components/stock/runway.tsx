import Link from "next/link";

import { daysLeftText } from "@/lib/stock/format";
import type { StockRow } from "@/lib/stock/load";
import type { StockStatus } from "@/lib/stock/plan";
import { cn } from "@/lib/utils";

const SPAN_DAYS = 14;
const BAR: Record<StockStatus, string> = {
  short: "fill-level-short",
  order: "fill-level-order",
  ok: "fill-level-ok",
  unknown: "fill-muted-foreground/30",
};

/**
 * "How long everything lasts": one bar per item, two weeks wide, with a dashed line on the
 * delivery day. Anything ending left of the line runs out before the truck arrives.
 */
export function Runway({
  rows,
  daysToDelivery,
  deliveryLabel,
}: {
  rows: StockRow[];
  daysToDelivery: number;
  deliveryLabel: string;
}) {
  const sorted = [...rows].sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));
  const marker = Math.min(SPAN_DAYS, daysToDelivery) * 10;
  return (
    <figure className="bg-card shadow-card rounded-2xl p-4 sm:p-6">
      <figcaption className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>How many days each item lasts at your current pace.</span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="2" height="12">
            <line
              x1="1"
              x2="1"
              y1="0"
              y2="12"
              className="stroke-foreground"
              strokeDasharray="2 2"
            />
          </svg>
          {deliveryLabel} delivery
        </span>
      </figcaption>
      <ul className="space-y-2.5">
        {sorted.map((row) => {
          const days = row.daysLeft ?? 0;
          const width = Math.max(1.5, Math.min(SPAN_DAYS, days) * 10);
          return (
            <li
              key={row.productId}
              className="grid grid-cols-[minmax(0,7.5rem)_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_6.5rem]"
            >
              <Link
                href={`/stock/${row.productId}`}
                className="truncate underline-offset-4 hover:underline"
              >
                {row.product.name}
              </Link>
              <svg
                aria-hidden
                viewBox="0 0 140 12"
                preserveAspectRatio="none"
                className="h-3.5 w-full overflow-visible"
              >
                <rect x={0} y={4} width={140} height={4} rx={2} className="fill-muted" />
                <rect
                  x={0}
                  y={2.5}
                  width={width}
                  height={7}
                  rx={1.5}
                  className={cn(
                    "animate-grow-x origin-left [transform-box:fill-box]",
                    BAR[row.status],
                  )}
                />
                <line
                  x1={marker}
                  x2={marker}
                  y1={-3}
                  y2={15}
                  className="stroke-foreground"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span
                className={cn(
                  "tabular text-right text-xs",
                  row.status === "short"
                    ? "text-destructive font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {daysLeftText(row.daysLeft, row.onHand)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="text-muted-foreground mt-3 grid grid-cols-[minmax(0,7.5rem)_1fr_5.5rem] gap-3 text-[11px] sm:grid-cols-[minmax(0,12rem)_1fr_6.5rem]">
        <span />
        <span className="flex justify-between">
          <span>Today</span>
          <span>1 week</span>
          <span>2 weeks+</span>
        </span>
        <span />
      </div>
    </figure>
  );
}
