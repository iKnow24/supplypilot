"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { findBestPrice } from "@/app/cart/actions";
import { Button } from "@/components/ui/button";

import { useAction } from "./status";

/** Runs the optimizer on the saved cart, then opens the result. */
export function FindBestPriceButton({ blockedReason }: { blockedReason: string | null }) {
  const router = useRouter();
  const { pending, run } = useAction();

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!!blockedReason || pending}
        aria-describedby="best-price-note"
        onClick={() =>
          run(
            () => findBestPrice(),
            (r) => {
              if (r.ok && r.runId) router.push(`/results/${r.runId}`);
            },
          )
        }
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Comparing suppliers…
          </>
        ) : (
          <>
            <Sparkles aria-hidden /> Find My Best Price
          </>
        )}
      </Button>
      <p id="best-price-note" className="text-muted-foreground text-xs" aria-live="polite">
        {pending
          ? "Checking every supplier's packs, stock, minimums and delivery fees."
          : (blockedReason ?? "Compares the total delivered cost across your allowed suppliers.")}
      </p>
    </div>
  );
}
