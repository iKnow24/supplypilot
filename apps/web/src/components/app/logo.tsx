import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The SupplyPilot mark: a compass rose drawn from grains.
 *  - Eight points: every supplier, every direction you could buy from.
 *  - The long gold north point is the one SupplyPilot picks.
 *  - Each point is a grain (a wheat kernel), so it reads as food first, navigation second.
 * Geometry lives in a 48-unit box. The rose is nudged down because the long north point
 * pulls the eye up; the badge version sits optically centred in its circle.
 * Fills use classes, never style attributes (the production CSP blocks inline styles).
 */
const GRAIN = "M0-20C5-13 5-5 0 0C-5-5-5-13 0-20Z";

function Rose({ point, north }: { point: string; north: string }) {
  return (
    <>
      <g className={point} opacity={0.45}>
        {[45, 135, 225, 315].map((r) => (
          <path key={r} d={GRAIN} transform={`rotate(${r}) scale(.52)`} />
        ))}
      </g>
      <g className={point}>
        {[90, 180, 270].map((r) => (
          <path key={r} d={GRAIN} transform={`rotate(${r}) scale(.8)`} />
        ))}
      </g>
      <path d={GRAIN} className={north} />
    </>
  );
}

export type MarkTone = "badge" | "ink" | "cream";

export function LogoMark({
  className,
  tone = "badge",
  title,
}: {
  className?: string;
  tone?: MarkTone;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {tone === "badge" ? (
        <>
          <circle cx="24" cy="24" r="24" className="fill-navy" />
          <circle
            cx="24"
            cy="24"
            r="21.6"
            fill="none"
            className="stroke-cream/20"
            strokeWidth=".8"
          />
          <g transform="translate(24 25.6) scale(.8)">
            <Rose point="fill-cream" north="fill-brass" />
          </g>
        </>
      ) : (
        <g transform="translate(24 26) scale(1.05)">
          <Rose point={tone === "ink" ? "fill-navy" : "fill-cream"} north="fill-brass" />
        </g>
      )}
    </svg>
  );
}

/** The wordmark: Fraunces, softened, set tight. One word, one colour. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("wordmark font-display", className)}>SupplyPilot</span>;
}

export function Logo({
  href = "/",
  className,
  tone = "badge",
}: {
  href?: string;
  className?: string;
  tone?: MarkTone;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 text-[21px] leading-none", className)}
      aria-label="SupplyPilot home"
    >
      <LogoMark tone={tone} className="size-[1.6em]" />
      <Wordmark className="-mt-[0.08em]" />
    </Link>
  );
}
