import { cn } from "@/lib/utils";

/**
 * A landing-page photo. A plain <img> on purpose: next/image adds inline style attributes,
 * which the production CSP (no 'unsafe-inline' styles) blocks. All photos are CC0; see
 * public/landing/CREDITS.md.
 */
export function Photo({
  src,
  alt = "",
  className,
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/${src}.jpg`}
      alt={alt}
      width={960}
      height={640}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("object-cover", className)}
    />
  );
}
