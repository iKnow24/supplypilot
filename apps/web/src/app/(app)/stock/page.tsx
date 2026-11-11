import { ArrowRight, Boxes, ShoppingCart, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { DeliverySelect } from "@/components/stock/delivery-select";
import { SliderLegend } from "@/components/stock/level";
import { Pantry } from "@/components/stock/pantry";
import { Runway } from "@/components/stock/runway";
import { StockList } from "@/components/stock/stock-list";
import { UnmatchedItems } from "@/components/store-setup/setup-prompt";
import { Button } from "@/components/ui/button";
import { formatDate, localParts } from "@/lib/delivery";
import { getSession } from "@/lib/session";
import { deliveryMark, loadStock } from "@/lib/stock/load";
import { BUFFER_DAYS, COVER_DAYS, daysBetween } from "@/lib/stock/plan";
import { cn } from "@/lib/utils";

import { startSuggestedOrder } from "./actions";

export const metadata: Metadata = { title: "Stock" };

const VIEWS = [
  { id: "pantry", label: "Pantry" },
  { id: "runway", label: "Runway" },
  { id: "list", label: "List" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const { for: wanted, error, view: viewParam } = await searchParams;
  const session = await getSession();

  if (!session.state) {
    return (
      <div>
        <PageHeader title="Stock" />
        <PersistenceNotice persistence={session.persistence} />
        <EmptyState icon={Boxes} title="Stock needs the database">
          Counts and usage are stored per business in the database. Once it&apos;s connected, this
          page shows what you have, how fast you use it, and what to order.
        </EmptyState>
      </div>
    );
  }

  const mode: ViewId = VIEWS.some((v) => v.id === viewParam) ? (viewParam as ViewId) : "pantry";
  const [view, storeItems] = await Promise.all([
    loadStock({ ...session, state: session.state }, typeof wanted === "string" ? wanted : null),
    session.state.listStoreItems(),
  ]);
  const fromDocuments = storeItems.length > 0;
  const today = localParts(view.now, view.timeZone).date;
  const short = view.rows.filter((r) => r.status === "short");
  const toOrder = view.rows.filter((r) => r.suggested > 0);
  const dateOptions = view.dates.map((d) => ({
    date: d.date,
    label: `${formatDate(d.date)} · ${d.available.length} supplier${d.available.length === 1 ? "" : "s"}`,
  }));
  const tabHref = (id: ViewId) => {
    const q = new URLSearchParams();
    if (id !== "pantry") q.set("view", id);
    if (typeof wanted === "string") q.set("for", wanted);
    const s = q.toString();
    return s ? `/stock?${s}` : "/stock";
  };

  return (
    <StatusProvider>
      <PageHeader
        eyebrow="Stock"
        title="Your pantry"
        description="How long each item lasts at your current pace. Tap one to see who sells it cheapest."
      />

      {typeof error === "string" ? (
        <p
          role="alert"
          className="bg-destructive-soft text-destructive mb-6 rounded-xl px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {view.rows.length === 0 || !view.deliveryDate ? (
        <EmptyState
          icon={Boxes}
          title="Nothing tracked yet"
          action={
            view.deliveryDate ? (
              <Button asChild>
                <Link href="/setup">Set up from your documents</Link>
              </Button>
            ) : null
          }
        >
          {view.deliveryDate
            ? "Upload your inventory count and a few recent invoices, and every item shows up here with how fast you use it."
            : "No supplier can deliver to you in the next two weeks, so there's nothing to plan for."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section
            aria-labelledby="draft"
            className="wash shadow-card animate-fade-up rounded-3xl p-6 sm:p-7"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 id="draft" className="font-display text-2xl font-medium">
                  {toOrder.length
                    ? `We drafted ${toOrder.length} item${toOrder.length === 1 ? "" : "s"} for ${formatDate(view.deliveryDate, "long")}`
                    : `You're covered for ${formatDate(view.deliveryDate, "long")}`}
                </h2>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  {short.length ? (
                    <span className="text-destructive font-medium">
                      {short.length} run{short.length === 1 ? "s" : ""} out before it arrives.{" "}
                    </span>
                  ) : null}
                  Amounts last until the delivery, then {COVER_DAYS} more days, plus a {BUFFER_DAYS}
                  -day buffer.
                </p>
                <div className="mt-4">
                  <DeliverySelect value={view.deliveryDate} options={dateOptions} />
                </div>
              </div>
              {toOrder.length ? (
                <form action={startSuggestedOrder} className="flex flex-col gap-2 lg:items-end">
                  <input type="hidden" name="deliveryDate" value={view.deliveryDate} />
                  <Button type="submit" size="lg">
                    <ShoppingCart aria-hidden /> Price this order <ArrowRight aria-hidden />
                  </Button>
                  <p className="text-muted-foreground text-xs">
                    Replaces what&apos;s in your cart. Nothing is sent until you approve.
                  </p>
                  <Link
                    href="/home#autopilot"
                    className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    <Sparkles className="size-4" aria-hidden /> Or let Autopilot plan and price it
                  </Link>
                </form>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="items">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="items" className="sr-only">
                Everything you track
              </h2>
              <nav aria-label="Stock views" className="bg-muted inline-flex rounded-xl p-1">
                {VIEWS.map((v) => (
                  <Link
                    key={v.id}
                    href={tabHref(v.id)}
                    aria-current={mode === v.id ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                      mode === v.id
                        ? "bg-card text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </Link>
                ))}
              </nav>
              {mode === "pantry" ? (
                <SliderLegend deliveryLabel={deliveryMark(view)?.label ?? null} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  {view.rows.length} items · tap one to see who sells it cheapest
                </p>
              )}
            </div>

            {mode === "pantry" ? <Pantry rows={view.rows} delivery={deliveryMark(view)} /> : null}
            {mode === "runway" ? (
              <Runway
                rows={view.rows}
                daysToDelivery={daysBetween(today, view.deliveryDate)}
                deliveryLabel={formatDate(view.deliveryDate)}
              />
            ) : null}
            {mode === "list" ? (
              <StockList rows={view.rows} now={view.now} timeZone={view.timeZone} today={today} />
            ) : null}

            <p className="text-muted-foreground mt-4 text-xs">
              {fromDocuments ? (
                <>
                  Weekly use was estimated from your invoices when you{" "}
                  <Link href="/setup" className="underline underline-offset-2">
                    set up from your documents
                  </Link>
                  . It gets sharper as you count.
                </>
              ) : (
                "Demo data: usage is a fictional estimate. In a real store it would come from your register sales and recipes, or from the change between counts."
              )}
            </p>
          </section>

          <UnmatchedItems items={storeItems} />
        </div>
      )}
    </StatusProvider>
  );
}
