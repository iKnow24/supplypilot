import { ArrowLeft, ImageUp, Info, ShoppingCart, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { ItemIcon, LevelSlider, SliderLegend } from "@/components/stock/level";
import { UsageChart } from "@/components/stock/sparkline";
import { CountEditor } from "@/components/stock/count-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SupplierSummary } from "@/lib/catalog/repository";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, nextDeliveryDates } from "@/lib/delivery";
import { FRESHNESS_LABEL } from "@/lib/freshness";
import { formatCents, formatUnitPrice } from "@/lib/money";
import { getSession } from "@/lib/session";
import { daysLeftText, qty, STATUS } from "@/lib/stock/format";
import { deliveryMark, loadStock } from "@/lib/stock/load";
import { UnitTable, unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";
import { localDay } from "@/lib/vendor-prices/parse";
import { latestQuotes } from "@/lib/vendor-prices/quotes";
import { DOCUMENT_KIND_LABEL } from "@/lib/vendor-prices/types";

import { addSuggestedItem } from "../actions";

type PriceCard = {
  kind: "catalog" | "quote";
  key: string;
  name: string;
  supplier: SupplierSummary | null;
  serves: boolean;
  next: string | null;
  current: boolean;
  unitCents: number;
  packLabel: string;
  packCents: number;
  detail: string;
  quoted?: string;
  warning: string | null;
};

export async function generateMetadata({
  params,
}: PageProps<"/stock/[productId]">): Promise<Metadata> {
  const { productId } = await params;
  const product = (await getRepository().listProducts()).find((p) => p.id === productId);
  return { title: product?.name ?? "Stock item" };
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
  const [view, offers, units, suppliers, source, vendorPrices] = await Promise.all([
    loadStock({ ...session, state: session.state }),
    repo.listOffersForBuyer(session.buyer.id),
    repo.units(),
    repo.listSuppliers(),
    repo.source(),
    session.state.listVendorPrices({ productId }),
  ]);
  const row = view.rows.find((r) => r.productId === productId);
  if (!row) notFound();

  const mark = deliveryMark(view);
  const table = new UnitTable(units);
  const zone = session.buyer.locations[0]!.zone;
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const nextFor = (s: SupplierSummary) =>
    nextDeliveryDates(s.policy, zone, source.now, source.timezone, 1)[0] ?? null;

  // Catalog offers and the buyer's own quotes (from screenshots), compared per unit.
  const catalogPrices: PriceCard[] = offers
    .filter((o) => o.product.id === row.productId)
    .map((o) => {
      const s = supplierById.get(o.supplierId)!;
      return {
        kind: "catalog",
        key: o.id,
        name: s.short_name,
        supplier: s,
        serves: s.servesZone(zone),
        next: nextFor(s),
        current: o.freshness.ok,
        unitCents: table.unitPriceCents(
          o.priceCents,
          Number(o.pack.quantity),
          o.pack.unit,
          row.unit,
        ),
        packLabel: o.pack.label,
        packCents: o.priceCents,
        detail: o.priceBasis === "contract" ? " (your contract)" : "",
        warning: o.freshness.ok
          ? null
          : `${o.freshness.reasons.map((r) => FRESHNESS_LABEL[r]).join(" · ")}, so it isn't used`,
      };
    });
  const maxQuoteDays = source.priceMaxAgeHours / 24;
  const quotePrices: PriceCard[] = latestQuotes(
    vendorPrices,
    localDay(new Date()),
    maxQuoteDays,
  ).map((q) => {
    const s = q.supplierId ? (supplierById.get(q.supplierId) ?? null) : null;
    return {
      kind: "quote",
      key: q.id,
      name: s?.short_name ?? q.vendorName,
      supplier: s,
      // A vendor that isn't in the catalog: its delivery terms aren't on file, so don't rule it out.
      serves: s ? s.servesZone(zone) : true,
      next: s ? nextFor(s) : null,
      current: q.current,
      unitCents: table.unitPriceCents(q.priceCents, Number(q.packQuantity), q.packUnit, row.unit),
      packLabel: q.packLabel,
      packCents: q.priceCents,
      detail: "",
      quoted: `Your quote · ${DOCUMENT_KIND_LABEL[q.documentKind].toLowerCase()} dated ${formatDate(q.quotedOn)}`,
      warning: q.current
        ? null
        : `Quote is ${q.ageDays} days old, so check it with your rep before relying on it`,
    };
  });
  const prices = [...catalogPrices, ...quotePrices].sort(
    (a, b) =>
      Number(b.serves) - Number(a.serves) ||
      Number(b.current) - Number(a.current) ||
      a.unitCents - b.unitCents,
  );
  const best = prices.find((p) => p.serves && p.current);

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
              <h1
                id="item"
                className="font-display mt-2 text-[28px] leading-tight font-medium sm:text-[34px]"
              >
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
          whole basket.{" "}
          {quotePrices.length > 0
            ? "Your quotes come from screenshots you added; Price this order doesn't use them yet."
            : null}
        </p>
        <Link
          href="/suppliers/import"
          className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <ImageUp className="size-4" aria-hidden /> Add a vendor&apos;s prices from a screenshot
        </Link>
        {prices.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">No supplier lists this item yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {prices.map((p) => {
              const isBest = p === best;
              return (
                <li
                  key={p.key}
                  className={cn(
                    "bg-card shadow-card relative rounded-2xl p-5",
                    isBest && "ring-level-ok ring-2",
                    (!p.serves || !p.current) && "opacity-70",
                  )}
                >
                  {isBest ? (
                    <span className="bg-level-ok text-primary-foreground absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      <Trophy className="size-3" aria-hidden /> Lowest price
                    </span>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.supplier ? (
                        <Link
                          href={`/suppliers/${p.supplier.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <p className="font-medium break-words">{p.name}</p>
                      )}
                      {p.kind === "quote" ? (
                        <Badge variant="accent" className="mt-1">
                          Your quote
                        </Badge>
                      ) : null}
                    </div>
                    <p className="tabular text-right">
                      <span className="text-xl font-semibold">{formatUnitPrice(p.unitCents)}</span>
                      <span className="text-muted-foreground text-xs">
                        /{unitShortLabel(row.unit)}
                      </span>
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {p.packLabel} · {formatCents(p.packCents)} a pack{p.detail}
                  </p>
                  {p.quoted ? (
                    <p className="text-muted-foreground mt-1 text-xs">{p.quoted}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-3 text-xs">
                    {!p.supplier
                      ? "Delivery terms not on file"
                      : !p.serves
                        ? "Doesn't deliver to you"
                        : p.next
                          ? `Next delivery ${formatDate(p.next)} · min order ${formatCents(p.supplier.policy.min_order_cents)}`
                          : "No delivery in the next 3 weeks"}
                  </p>
                  {p.warning ? <p className="text-warning mt-1 text-xs">{p.warning}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StatusProvider>
  );
}
