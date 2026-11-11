"use client";

// Drawn in the browser on purpose: if a streamed chunk boundary fell inside a server-rendered
// <svg>, React would wrap the late part in <svg style="display:none">, which the CSP blocks.
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Weekly use as tiny bars. Pure SVG attributes (no inline styles), so it passes the CSP.
 * Decorative: the numbers next to it say the same thing in words.
 */
export function UsageBars({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1e-9);
  const w = 6;
  const gap = 2;
  const h = 22;
  return (
    <svg
      aria-hidden
      width={values.length * (w + gap) - gap}
      height={h}
      viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`}
      className="shrink-0"
    >
      {values.map((v, i) => {
        const bar = Math.max(2, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bar}
            width={w}
            height={bar}
            rx={1.5}
            className={i >= values.length - 4 ? "fill-primary/70" : "fill-muted-foreground/25"}
          />
        );
      })}
    </svg>
  );
}

/** Eight weeks of use as labelled bars. */
export function UsageChart({ values, unit }: { values: number[]; unit: string }) {
  const max = Math.max(...values, 1e-9);
  return (
    <figure>
      <figcaption className="text-muted-foreground mb-3 text-xs">
        Weekly use, last {values.length} weeks (newest on the right)
      </figcaption>
      <div className="flex h-32 items-end gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="tabular text-muted-foreground text-[10px]">{Math.round(v)}</span>
            <svg
              aria-hidden
              viewBox="0 0 10 100"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <rect
                x={0}
                y={100 - Math.max(3, (v / max) * 100)}
                width={10}
                height={Math.max(3, (v / max) * 100)}
                rx={1.5}
                className={cn(
                  "animate-fill-rise origin-bottom [transform-box:fill-box]",
                  i >= values.length - 4 ? "fill-level-ok" : "fill-muted-foreground/20",
                )}
              />
            </svg>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        In {unitShortLabel(unit)}. The green weeks set your burn rate.
      </p>
    </figure>
  );
}
