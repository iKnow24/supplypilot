import { ArrowRight, Boxes, CircleAlert, PackageCheck, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { CountEditor } from "@/components/stock/count-editor";
import { DeliverySelect } from "@/components/stock/delivery-select";
import { UsageBars } from "@/components/stock/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime, localParts } from "@/lib/delivery";
import { getSession } from "@/lib/session";
import { loadStock, type StockRow } from "@/lib/stock/load";
import { BUFFER_DAYS, COVER_DAYS, daysBetween, type StockStatus } from "@/lib/stock/plan";
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

import { startSuggestedOrder } from "./actions";

export const metadata: Metadata = { title: "Stock" };

const STATUS: Record<
  StockStatus,
  { label: string; variant: "destructive" | "warning" | "success" | "neutral" }
> = {
  short: { label: "Runs out first", variant: "destructive" },
  order: { label: "Order", variant: "warning" },
  ok: { label: "Enough", variant: "success" },
  unknown: { label: "Needs a count", variant: "neutral" },
};

function qty(n: number, unit: string) {
  const v = unit === "each" ? Math.round(n) : Math.round(n * 10) / 10;
  const label = unit === "each" ? "" : ` ${unitShortLabel(unit)}`;
  return `${v.toLocaleString("en-US")}${label}`;
}

function OnHand({ row, now, timeZone }: { row: StockRow; now: Date; timeZone: string }) {
  if (row.onHand === null) return <span className="text-muted-foreground">Not counted</span>;
  const count = row.count;
  // The demo runs on a fixed clock, so a count saved today is "newer" than the demo's now.
  const justNow = count && count.countedAt >= now;
  const counted = count && !justNow ? localParts(count.countedAt, timeZone) : null;
  return (
    <div>
      <p className="tabular font-medium">{qty(row.onHand, row.unit)}</p>
      {justNow ? (
        <p className="text-muted-foreground text-xs">Just counted</p>
      ) : counted && count ? (
        <p className="text-muted-foreground text-xs">
          Counted {qty(count.quantity, row.unit)}, {formatDate(counted.date)}{" "}
          {formatTime(counted.time)}
        </p>
      ) : null}
    </div>
  );
}

function Burn({ row }: { row: StockRow }) {
  const pct = row.trend === null ? 0 : Math.round(row.trend * 100);
  return (
    <div className="flex items-center gap-3">
      <UsageBars values={row.history} />
      <div>
        <p className="tabular font-medium">{qty(row.weekly, row.unit)}/wk</p>
        {Math.abs(pct) >= 5 ? (
          <p className={cn("text-xs", pct > 0 ? "text-warning" : "text-muted-foreground")}>
            {pct > 0 ? "Up" : "Down"} {Math.abs(pct)}% vs the month before
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Steady</p>
        )}
      </div>
    </div>
  );
}

function RunsOut({ row, today }: { row: StockRow; today: string }) {
  if (!row.runsOutOn) return <span className="text-muted-foreground">—</span>;
  const days = daysBetween(today, row.runsOutOn);
  return (
    <div>
      <p className={cn("tabular font-medium", row.status === "short" && "text-destructive")}>
        {formatDate(row.runsOutOn)}
      </p>
      <p className="text-muted-foreground text-xs">
        {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
      </p>
    </div>
  );
}

function Suggested({ row }: { row: StockRow }) {
  if (row.status === "unknown")
    return <span className="text-muted-foreground">Count it first</span>;
  if (row.suggested === 0) return <span className="text-muted-foreground">Skip this time</span>;
  return <span className="tabular font-semibold">{qty(row.suggested, row.unit)}</span>;
}

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const { for: wanted, error } = await searchParams;
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

  const view = await loadStock(
    { ...session, state: session.state },
    typeof wanted === "string" ? wanted : null,
  );
  const today = localParts(view.now, view.timeZone).date;
  const short = view.rows.filter((r) => r.status === "short");
  const toOrder = view.rows.filter((r) => r.suggested > 0);
  const fine = view.rows.filter((r) => r.status === "ok");
  const dateOptions = view.dates.map((d) => ({
    date: d.date,
    label: `${formatDate(d.date)} · ${d.available.length} supplier${d.available.length === 1 ? "" : "s"}`,
  }));

  return (
    <StatusProvider>
      <PageHeader
        eyebrow="Stock"
        title="What you have, and what to order"
        description="On hand is estimated from your last count and how fast you've used each item over the past 4 weeks."
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
        <EmptyState icon={Boxes} title="Nothing tracked yet">
          {view.deliveryDate
            ? "Once you count your shelves and have a few weeks of usage, every item shows up here."
            : "No supplier can deliver to you in the next two weeks, so there's nothing to plan for."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section
            aria-labelledby="draft"
            className="wash shadow-card animate-fade-up relative overflow-hidden rounded-3xl p-6 sm:p-8"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <h2 id="draft" className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {toOrder.length
                    ? `We drafted ${toOrder.length} item${toOrder.length === 1 ? "" : "s"} for ${formatDate(view.deliveryDate, "long")}`
                    : `You're covered for ${formatDate(view.deliveryDate, "long")}`}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Each amount lasts until the delivery arrives, then {COVER_DAYS} more days, plus a{" "}
                  {BUFFER_DAYS}-day buffer. Nothing is ordered until you compare suppliers and
                  approve.
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
                    Replaces what&apos;s in your cart.
                  </p>
                </form>
              ) : null}
            </div>

            <dl className="stagger mt-6 grid gap-3 sm:grid-cols-3">
              <div className="bg-card/80 rounded-2xl p-4 ring-1 ring-black/5">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <CircleAlert className="text-destructive size-3.5" aria-hidden /> Run out before
                  it arrives
                </dt>
                <dd className="tabular mt-1 text-2xl font-semibold">{short.length}</dd>
              </div>
              <div className="bg-card/80 rounded-2xl p-4 ring-1 ring-black/5">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <ShoppingCart className="text-warning size-3.5" aria-hidden /> To order
                </dt>
                <dd className="tabular mt-1 text-2xl font-semibold">{toOrder.length}</dd>
              </div>
              <div className="bg-card/80 rounded-2xl p-4 ring-1 ring-black/5">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <PackageCheck className="text-success size-3.5" aria-hidden /> Enough for now
                </dt>
                <dd className="tabular mt-1 text-2xl font-semibold">{fine.length}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="items">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 id="items" className="text-[15px] font-semibold tracking-tight">
                Everything you track
              </h2>
              <Link
                href="/cart"
                className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
              >
                Open Smart Cart
              </Link>
            </div>

            {/* Tablet and up: one row per item. */}
            <div className="bg-card shadow-card hidden overflow-hidden rounded-2xl md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead>On hand now</TableHead>
                    <TableHead>Weekly use</TableHead>
                    <TableHead>Runs out</TableHead>
                    <TableHead>Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.rows.map((row) => (
                    <TableRow key={row.productId} className="align-top">
                      <TableCell className="py-3">
                        <p className="font-medium">{row.product.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={STATUS[row.status].variant}>
                            {STATUS[row.status].label}
                          </Badge>
                          <CountEditor
                            productId={row.productId}
                            productName={row.product.name}
                            unitLabel={unitShortLabel(row.unit)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <OnHand row={row} now={view.now} timeZone={view.timeZone} />
                      </TableCell>
                      <TableCell className="py-3">
                        <Burn row={row} />
                      </TableCell>
                      <TableCell className="py-3">
                        <RunsOut row={row} today={today} />
                      </TableCell>
                      <TableCell className="py-3">
                        <Suggested row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phones: one card per item. */}
            <ul className="space-y-3 md:hidden">
              {view.rows.map((row) => (
                <li key={row.productId} className="bg-card shadow-card rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{row.product.name}</p>
                    <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs">On hand now</dt>
                      <dd>
                        <OnHand row={row} now={view.now} timeZone={view.timeZone} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Order</dt>
                      <dd>
                        <Suggested row={row} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Weekly use</dt>
                      <dd>
                        <Burn row={row} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Runs out</dt>
                      <dd>
                        <RunsOut row={row} today={today} />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2">
                    <CountEditor
                      productId={row.productId}
                      productName={row.product.name}
                      unitLabel={unitShortLabel(row.unit)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Demo data: usage is a fictional estimate. In a real store it would come from your
              register sales and recipes, or from the change between counts.
            </p>
          </section>
        </div>
      )}
    </StatusProvider>
  );
}
