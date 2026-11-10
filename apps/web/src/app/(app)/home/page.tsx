import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  PiggyBank,
  ShoppingCart,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { startSuggestedOrder } from "@/app/(app)/stock/actions";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { ItemIcon, SliderLegend } from "@/components/stock/level";
import { PantryTile } from "@/components/stock/pantry";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";
import { daysLeftText } from "@/lib/stock/format";
import { deliveryMark, loadStock } from "@/lib/stock/load";
import { greeting } from "@/lib/view";

export const metadata: Metadata = { title: "Home" };

/**
 * The calm dashboard: what needs you, the order we drafted, and the pantry at a glance.
 * Everything else lives one tap away in the sidebar.
 */
export default async function HomePage() {
  const repo = getRepository();
  const session = await getSession();
  const { buyer, persistence, state } = session;
  const source = await repo.source();
  const hello = greeting(source.now, source.timezone);

  if (!state) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">{hello}.</h1>
        <PersistenceNotice persistence={persistence} />
        <Button asChild size="lg">
          <Link href="/cart">
            Open Smart Cart <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  const [stock, runs, orders] = await Promise.all([
    loadStock({ ...session, state }),
    state.listRuns(20),
    state.listPurchaseOrders({ limit: 1 }),
  ]);
  const short = stock.rows.filter((r) => r.status === "short");
  const toOrder = stock.rows.filter((r) => r.suggested > 0);
  const urgent = stock.rows.filter((r) => r.status !== "unknown").slice(0, 6);
  const saved = runs.find((r) => r.savingsCents !== null && r.savingsCents > 0);
  const lastOrder = orders[0];
  const delivery = stock.deliveryDate;
  const mark = deliveryMark(stock);

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <p className="text-muted-foreground text-sm">{buyer.name}</p>
        <h1 id="hello" className="mt-1 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {hello}.{" "}
          <span className="text-muted-foreground">
            {short.length
              ? `${short.length} thing${short.length === 1 ? "" : "s"} need${short.length === 1 ? "s" : ""} you before ${delivery ? formatDate(delivery) : "the next delivery"}.`
              : "You're stocked up."}
          </span>
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* What needs attention: red, at the top, impossible to miss. */}
        <section
          aria-labelledby="attention"
          className="bg-card shadow-card animate-fade-up rounded-3xl p-6 lg:col-span-2"
        >
          <h2 id="attention" className="flex items-center gap-2 text-[15px] font-semibold">
            {short.length ? (
              <CircleAlert className="text-destructive size-4" aria-hidden />
            ) : (
              <CircleCheck className="text-success size-4" aria-hidden />
            )}
            Needs attention
          </h2>
          {short.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Nothing runs out before your next delivery.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {short.slice(0, 4).map((row) => {
                return (
                  <li key={row.productId}>
                    <Link
                      href={`/stock/${row.productId}`}
                      className="bg-destructive-soft/60 hover:bg-destructive-soft flex items-center gap-3 rounded-2xl p-2.5 pr-3 transition-colors"
                    >
                      <ItemIcon product={row.product} status={row.status} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {row.product.name}
                        </span>
                        <span className="text-destructive block text-xs font-medium">
                          {daysLeftText(row.daysLeft, row.onHand)}
                          {row.runsOutOn ? ` · runs out ${formatDate(row.runsOutOn)}` : ""}
                        </span>
                      </span>
                      <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                        Best price <ArrowRight className="size-3.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* The order we drafted from stock. */}
        <section
          aria-labelledby="next-order"
          className="wash shadow-card animate-fade-up relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-3"
        >
          <div
            aria-hidden
            className="dots absolute inset-y-0 right-0 hidden w-1/2 [mask-image:linear-gradient(to_left,#000,transparent)] opacity-60 sm:block"
          />
          <div className="relative">
            <h2 id="next-order" className="text-muted-foreground text-sm font-medium">
              Your next order
            </h2>
            {delivery && toOrder.length ? (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {toOrder.length} item{toOrder.length === 1 ? "" : "s"} for {formatDate(delivery)}
                </p>
                <p className="text-muted-foreground mt-2 max-w-md text-sm">
                  Drafted from what you have and how fast you use it. Price it to compare every
                  supplier on the total delivered cost.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <form action={startSuggestedOrder}>
                    <input type="hidden" name="deliveryDate" value={delivery} />
                    <Button type="submit" size="lg" className="w-full sm:w-auto">
                      <ShoppingCart aria-hidden /> Price this order <ArrowRight aria-hidden />
                    </Button>
                  </form>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/stock">Review amounts</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight">Nothing to order yet</p>
                <Button asChild size="lg" className="mt-6">
                  <Link href="/cart">
                    Open Smart Cart <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="pantry">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 id="pantry" className="text-[15px] font-semibold tracking-tight">
              Pantry at a glance
            </h2>
            <SliderLegend deliveryLabel={mark?.label ?? null} />
          </div>
          <Link
            href="/stock"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            All stock <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {urgent.map((row) => (
            <li key={row.productId}>
              <PantryTile row={row} delivery={mark} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="money" className="grid gap-3 sm:grid-cols-2">
        <h2 id="money" className="sr-only">
          Savings and orders
        </h2>
        <div className="bg-card shadow-card flex min-w-0 items-center gap-4 rounded-2xl p-5">
          <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <PiggyBank className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Verified savings</p>
            <p className="tabular text-xl font-semibold">
              {saved ? formatCents(saved.savingsCents!) : "—"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {saved ? (
                <Link href={`/results/${saved.id}`} className="underline underline-offset-2">
                  Against your usual suppliers. See how
                </Link>
              ) : (
                "Measured against your usual suppliers, never estimated."
              )}
            </p>
          </div>
        </div>
        <Link
          href={lastOrder ? `/orders/${lastOrder.id}` : "/orders"}
          className="bg-card shadow-card hover:shadow-raised flex min-w-0 items-center gap-4 rounded-2xl p-5 transition-shadow"
        >
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <ShoppingCart className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Last purchase order</p>
            <p className="tabular text-xl font-semibold">
              {lastOrder ? formatCents(lastOrder.total_cents) : "None yet"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {lastOrder
                ? `${lastOrder.number} · ${lastOrder.supplier_name.replace(" (Demo)", "")} · ${formatDate(lastOrder.delivery_date)}`
                : "Approve a priced order to create one."}
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}
