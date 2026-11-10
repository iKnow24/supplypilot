import { CircleCheck, Lock, Truck } from "lucide-react";

/**
 * A faithful, static miniature of the real results screen (demo scenario 3: Third Shift
 * Coffee, Wed Nov 11). Decorative: the hero text already says what it shows.
 */
export function ProductMockup() {
  return (
    <div aria-hidden className="glow-border rounded-2xl">
      <div className="overflow-hidden rounded-2xl bg-[oklch(0.2_0.007_250)] p-1.5 shadow-[0_40px_120px_-20px_oklch(0.6_0.15_163/0.35)]">
        {/* window chrome */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-1 text-[11px] text-zinc-400">
            <Lock className="size-3" />
            supplypilot-nu.vercel.app/results
          </div>
          <div className="w-12" />
        </div>

        {/* the app, light, as it really looks */}
        <div className="bg-background text-foreground grid gap-4 rounded-xl p-4 text-left sm:p-6 md:grid-cols-[1.55fr_1fr]">
          <div className="space-y-4">
            <div className="wash shadow-card rounded-2xl p-5">
              <p className="text-muted-foreground text-xs font-medium">
                Lowest total delivered cost
              </p>
              <p className="tabular mt-1 text-4xl font-semibold tracking-tight">$132.60</p>
              <p className="text-muted-foreground mt-1 text-xs">
                $117.60 items + $15.00 delivery · 1 supplier · Wed, Nov 11
              </p>
            </div>
            <div className="bg-card shadow-card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="text-muted-foreground size-4" /> Meadowlark Dairy Co-op
                </p>
                <span className="bg-card rounded-full border px-2 py-0.5 text-[10px] font-medium">
                  Order by Tue, 6 PM
                </span>
              </div>
              <div className="mt-3 divide-y text-xs">
                {[
                  ["Whole milk", "Case, 4 × 1 gal · contract", "4", "$75.60"],
                  ["Oat milk, barista", "Case, 12 × 32 oz", "1", "$42.00"],
                ].map(([name, pack, packs, total]) => (
                  <div key={name} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{name}</p>
                      <p className="text-muted-foreground text-[11px]">{pack}</p>
                    </div>
                    <span className="tabular text-muted-foreground w-6 text-right">{packs}</span>
                    <span className="tabular w-14 text-right font-medium">{total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card shadow-card rounded-2xl p-4">
              <p className="text-sm font-semibold">Other ways to buy it</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="bg-accent/60 flex items-center justify-between rounded-lg px-3 py-2">
                  <span className="font-medium">Best price · Meadowlark</span>
                  <span className="tabular font-semibold">$132.60</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="font-medium">Lowest item prices · Pelican</span>
                  <span className="tabular text-right">
                    $150.90
                    <span className="text-destructive block text-[10px]">+$18.30</span>
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                Items cost $11.70 less at Pelican, but its $45 delivery fee makes the order $18.30
                more.
              </p>
            </div>
            <div className="bg-card shadow-card rounded-2xl p-4">
              <p className="text-sm font-semibold">Happy with this plan?</p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Creates a draft purchase order. Nothing is sent to anyone.
              </p>
              <div className="from-primary to-primary-strong mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b py-2 text-xs font-medium text-white">
                <CircleCheck className="size-3.5" /> Approve plan
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
