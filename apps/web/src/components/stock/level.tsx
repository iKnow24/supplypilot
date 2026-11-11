"use client";

// Drawn in the browser on purpose: if a streamed chunk boundary fell inside a server-rendered
// <svg>, React would wrap the late part in <svg style="display:none">, which the CSP blocks.
/**
 * The item icon (in a status-tinted square) and the level slider: how many days the stock
 * lasts across a two-week track, with a tick on the delivery day. Pure SVG attributes and
 * Tailwind classes, so it passes the CSP. Decorative: the text beside it says the same.
 */
import { lookFor, SPAN_DAYS } from "@/lib/stock/look";
import type { StockStatus } from "@/lib/stock/plan";
import { cn } from "@/lib/utils";

const TINT: Record<StockStatus, string> = {
  short: "bg-destructive-soft text-destructive",
  order: "bg-warning-soft text-warning",
  ok: "bg-accent text-accent-foreground",
  unknown: "bg-muted text-muted-foreground",
};

const SIZE = {
  sm: "size-9 rounded-lg [&_svg]:size-4.5",
  md: "size-11 rounded-xl [&_svg]:size-5",
  lg: "size-20 rounded-2xl [&_svg]:size-9",
} as const;

export function ItemIcon({
  product,
  status,
  size = "md",
}: {
  product: { id: string; category: string };
  status: StockStatus;
  size?: keyof typeof SIZE;
}) {
  const Icon = lookFor(product).icon;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center", TINT[status], SIZE[size])}
    >
      <Icon strokeWidth={1.75} />
    </span>
  );
}

const FILL: Record<StockStatus, string> = {
  short: "fill-level-short",
  order: "fill-level-order",
  ok: "fill-level-ok",
  unknown: "fill-muted-foreground/30",
};

export function LevelSlider({
  daysLeft,
  status,
  deliveryInDays,
  scale = true,
  className,
}: {
  daysLeft: number | null;
  status: StockStatus;
  deliveryInDays: number | null;
  /** Show "Today … 2 wks" under the track. */
  scale?: boolean;
  className?: string;
}) {
  const unit = 100 / SPAN_DAYS;
  const width = daysLeft === null ? 0 : Math.max(1.2, Math.min(SPAN_DAYS, daysLeft) * unit);
  const tick =
    deliveryInDays === null ? null : Math.min(SPAN_DAYS, Math.max(0, deliveryInDays)) * unit;
  return (
    <div className={cn("w-full", className)}>
      <svg
        aria-hidden
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-2.5 w-full overflow-visible"
      >
        <rect x={0} y={2} width={100} height={6} rx={3} className="fill-muted" />
        <rect
          x={0}
          y={2}
          width={width}
          height={6}
          rx={3}
          className={cn("animate-grow-x origin-left [transform-box:fill-box]", FILL[status])}
        />
        {tick !== null ? (
          <line
            x1={tick}
            x2={tick}
            y1={-1.5}
            y2={11.5}
            className="stroke-foreground/70"
            strokeWidth={1.5}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {scale ? (
        <div className="text-muted-foreground mt-1 flex items-center justify-between text-[10px] leading-none">
          <span>Today</span>
          <span>2 wks</span>
        </div>
      ) : null}
    </div>
  );
}

/** One legend for a whole set of sliders. */
export function SliderLegend({ deliveryLabel }: { deliveryLabel: string | null }) {
  return (
    <p className="text-muted-foreground inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-level-ok h-1.5 w-5 rounded-full" /> Bars run from today to 2 weeks
      </span>
      {deliveryLabel ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="border-foreground/70 h-3 border-l-[1.5px] border-dashed" />
          {deliveryLabel} delivery
        </span>
      ) : null}
    </p>
  );
}
