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
