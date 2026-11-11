"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The floating top bar: logo on the far left, the main links in the middle, the store picker
 * and settings on the far right. It floats over the page and firms up (more opaque, deeper
 * shadow) once content scrolls under it.
 */
export function FloatingHeader({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const onScroll = () => bar.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        ref={barRef}
        className="glass-bar relative mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-2xl pr-2 pl-4 md:h-[60px]"
      >
        <div className="shrink-0">{left}</div>
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">{center}</div>
        <div className="ml-auto flex items-center gap-1.5">{right}</div>
      </div>
    </header>
  );
}
