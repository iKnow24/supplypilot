import { ArrowLeft, Info, ShoppingCart, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { ItemIcon, LevelSlider, SliderLegend } from "@/components/stock/level";
import { CountEditor } from "@/components/stock/count-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, nextDeliveryDates } from "@/lib/delivery";
import { FRESHNESS_LABEL } from "@/lib/freshness";
import { formatCents, formatUnitPrice } from "@/lib/money";
import { getSession } from "@/lib/session";
import { daysLeftText, qty, STATUS } from "@/lib/stock/format";
import { deliveryMark, loadStock } from "@/lib/stock/load";
import { UnitTable, unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

import { addSuggestedItem } from "../actions";

export async function generateMetadata({
  params,
}: PageProps<"/stock/[productId]">): Promise<Metadata> {
  const { productId } = await params;
  const product = (await getRepository().listProducts()).find((p) => p.id === productId);
  return { title: product?.name ?? "Stock item" };
}

/** Eight weeks of use as labelled bars. */
function UsageChart({ values, unit }: { values: number[]; unit: string }) {
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

export default async function StockItemPage({
  params,
  searchParams,
}: PageProps<"/stock/[productId]">) {
  const [{ productId }, { error }] = await Promise.all([params, searchParams]);
  const session = await getSession();
  if (!session.state) {
    return (
      <div>
        <Link href="/stock" className="text-muted-foreground text-sm">
          ← Stock
        </Link>
        <PersistenceNotice persistence={session.persistence} />
      </div>
    );
  }

  const repo = getRepository();
  const [view, offers, units, suppliers, source] = await Promise.all([
    loadStock({ ...session, state: session.state }),
    repo.listOffersForBuyer(session.buyer.id),
    repo.units(),
    repo.listSuppliers(),
    repo.source(),
  ]);
  const row = view.rows.find((r) => r.productId === productId);
  if (!row) notFound();

  const mark = deliveryMark(view);
  const table = new UnitTable(units);
  const zone = session.buyer.locations[0]!.zone;
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const prices = offers
    .filter((o) => o.product.id === row.productId)
    .map((o) => {
      const s = supplierById.get(o.supplierId)!;
      return {
        offer: o,
        supplier: s,
        serves: s.servesZone(zone),
        next: nextDeliveryDates(s.policy, zone, source.now, source.timezone, 1)[0] ?? null,
        unitCents: table.unitPriceCents(
          o.priceCents,
          Number(o.pack.quantity),
          o.pack.unit,
          row.unit,
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(b.serves) - Number(a.serves) ||
        Number(b.offer.freshness.ok) - Number(a.offer.freshness.ok) ||
        a.unitCents - b.unitCents,
    );
  const best = prices.find((p) => p.serves && p.offer.freshness.ok);

  return (
    <StatusProvider>
      <Link
        href="/stock"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Stock
      </Link>

      {typeof error === "string" ? (
        <p
          role="alert"
          className="bg-destructive-soft text-destructive mb-6 rounded-xl px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <section
          aria-labelledby="item"
          className="wash shadow-card animate-fade-up rounded-3xl p-6 sm:p-8 lg:col-span-3"
        >
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <ItemIcon product={row.product} status={row.status} size="lg" />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
              <h1 id="item" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {row.product.name}
              </h1>
              <p className={cn("tabular mt-3 text-4xl font-semibold", STATUS[row.status].text)}>
                {daysLeftText(row.daysLeft, row.onHand)}
              </p>
              {row.runsOutOn ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  Runs out around {formatDate(row.runsOutOn, "long")}
                  {row.status === "short" && view.deliveryDate
                    ? `, before your ${formatDate(view.deliveryDate)} delivery`
                    : ""}
                  .
                </p>
              ) : null}
              <LevelSlider
                className="mt-4"
                daysLeft={row.daysLeft}
                status={row.status}
                deliveryInDays={mark?.inDays ?? null}
              />
              <div className="mt-2">
                <SliderLegend deliveryLabel={mark?.label ?? null} />
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-left">
                <div className="bg-card/80 rounded-xl p-3 ring-1 ring-black/5">
                  <dt className="text-muted-foreground text-xs">On hand</dt>
                  <dd className="tabular mt-0.5 font-semibold">
                    {row.onHand === null ? "—" : qty(row.onHand, row.unit)}
                  </dd>
                </div>
                <div className="bg-card/80 rounded-xl p-3 ring-1 ring-black/5">
                  <dt className="text-muted-foreground text-xs">Uses a week</dt>
                  <dd className="tabular mt-0.5 font-semibold">{qty(row.weekly, row.unit)}</dd>
                </div>
                <div className="bg-card/80 rounded-xl p-3 ring-1 ring-black/5">
                  <dt className="text-muted-foreground text-xs">Order now</dt>
                  <dd className="tabular mt-0.5 font-semibold">
                    {row.suggested ? qty(row.suggested, row.unit) : "None"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {row.suggested > 0 ? (
                  <form action={addSuggestedItem}>
                    <input type="hidden" name="productId" value={row.productId} />
                    <Button type="submit">
                      <ShoppingCart aria-hidden /> Add {qty(row.suggested, row.unit)} to cart
                    </Button>
                  </form>
                ) : null}
                <CountEditor
                  productId={row.productId}
                  productName={row.product.name}
                  unitLabel={unitShortLabel(row.unit)}
                />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Usage" className="bg-card shadow-card rounded-3xl p-6 lg:col-span-2">
          <UsageChart values={row.history} unit={row.unit} />
        </section>
      </div>

      <section aria-labelledby="prices" className="mt-8">
        <h2 id="prices" className="text-lg font-semibold tracking-tight">
          Who sells it cheapest right now
        </h2>
        <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Item price per {unitShortLabel(row.unit)}, with your contract prices applied. Delivery
          fees and minimums can still change the cheapest overall, so Price this order compares the
          whole basket.
        </p>
        {prices.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">No supplier lists this item yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {prices.map((p) => {
              const isBest = p === best;
              const stale = !p.offer.freshness.ok;
              return (
                <li
                  key={p.offer.id}
                  className={cn(
                    "bg-card shadow-card relative rounded-2xl p-5",
                    isBest && "ring-level-ok ring-2",
                    (!p.serves || stale) && "opacity-70",
                  )}
                >
                  {isBest ? (
                    <span className="bg-level-ok text-primary-foreground absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      <Trophy className="size-3" aria-hidden /> Lowest price
                    </span>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/suppliers/${p.supplier.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.supplier.short_name}
                    </Link>
                    <p className="tabular text-right">
                      <span className="text-xl font-semibold">{formatUnitPrice(p.unitCents)}</span>
                      <span className="text-muted-foreground text-xs">
                        /{unitShortLabel(row.unit)}
                      </span>
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {p.offer.pack.label} · {formatCents(p.offer.priceCents)} a pack
                    {p.offer.priceBasis === "contract" ? " (your contract)" : ""}
                  </p>
                  <p className="text-muted-foreground mt-3 text-xs">
                    {!p.serves
                      ? "Doesn't deliver to you"
                      : p.next
                        ? `Next delivery ${formatDate(p.next)} · min order ${formatCents(p.supplier.policy.min_order_cents)}`
                        : "No delivery in the next 3 weeks"}
                  </p>
                  {stale ? (
                    <p className="text-warning mt-1 text-xs">
                      {p.offer.freshness.ok
                        ? null
                        : p.offer.freshness.reasons.map((r) => FRESHNESS_LABEL[r]).join(" · ")}
                      , so it isn&apos;t used
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StatusProvider>
  );
}
