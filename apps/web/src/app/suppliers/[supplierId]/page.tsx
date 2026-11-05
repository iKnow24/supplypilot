import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRepository } from "@/lib/catalog/seed-repository";
import { WEEKDAY_SHORT } from "@/lib/delivery";
import { FRESHNESS_LABEL, formatAge } from "@/lib/freshness";
import { formatCents, formatUnitPrice } from "@/lib/money";
import { getCurrentBuyer } from "@/lib/demo-session";
import { UnitTable, unitShortLabel } from "@/lib/units";

export async function generateMetadata({
  params,
}: PageProps<"/suppliers/[supplierId]">): Promise<Metadata> {
  const { supplierId } = await params;
  const s = await getRepository().getSupplier(supplierId);
  return { title: s?.name ?? "Supplier" };
}

export default async function SupplierPage({ params }: PageProps<"/suppliers/[supplierId]">) {
  const { supplierId } = await params;
  const repo = getRepository();
  const supplier = await repo.getSupplier(supplierId);
  if (!supplier) notFound();
  const buyer = await getCurrentBuyer();
  const [offers, units, source] = await Promise.all([
    repo.listOffersForBuyer(buyer.id, { supplierId }),
    repo.units(),
    repo.source(),
  ]);
  const table = new UnitTable(units);
  const p = supplier.policy;
  offers.sort(
    (a, b) =>
      a.product.category.localeCompare(b.product.category) ||
      a.product.name.localeCompare(b.product.name),
  );

  return (
    <div>
      <Link
        href="/suppliers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All suppliers
      </Link>
      <PageHeader title={supplier.name} description={supplier.description} />
      {!supplier.servesZone(buyer.locations[0]!.zone) ? (
        <p className="-mt-4 mb-6">
          <Badge variant="destructive">
            <MapPin aria-hidden /> Doesn&apos;t deliver to {buyer.locations[0]!.name}
          </Badge>
        </p>
      ) : null}

      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-5 text-sm sm:grid-cols-4 sm:pt-6">
          <div>
            <p className="text-muted-foreground">Delivers</p>
            <p className="font-medium">
              {p.delivery_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}
            </p>
            <p className="text-muted-foreground tabular">
              {p.delivery_window.start}–{p.delivery_window.end}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Order minimum</p>
            <p className="tabular font-medium">
              {p.min_order_cents ? formatCents(p.min_order_cents) : "None"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Delivery fee</p>
            <p className="tabular font-medium">{formatCents(p.delivery_fee_cents)}</p>
            {p.free_delivery_threshold_cents !== null ? (
              <p className="text-muted-foreground tabular">
                Free over {formatCents(p.free_delivery_threshold_cents)}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Data source</p>
            <p className="font-medium">
              {supplier.synthetic ? "Synthetic demo catalog" : "Supplier catalog"}
            </p>
            <p className="text-muted-foreground">Not live pricing or stock</p>
          </div>
        </CardContent>
      </Card>

      {/* Phones: a stacked list, so price and stock are never hidden behind a sideways scroll. */}
      <ul className="space-y-3 md:hidden" aria-label="Catalog items">
        {offers.map((o) => {
          const unitPrice = table.unitPriceCents(
            o.priceCents,
            Number(o.pack.quantity),
            o.pack.unit,
            o.product.default_unit,
          );
          return (
            <li key={o.id}>
              <Card>
                <CardContent className="space-y-2 pt-4 pb-4 sm:pt-4 sm:pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.product.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {o.pack.label}
                        {o.minPacks > 1 ? ` · min ${o.minPacks} packs` : ""}
                      </p>
                    </div>
                    <div className="tabular text-right">
                      <p className="font-medium">{formatCents(o.priceCents)}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatUnitPrice(unitPrice)}/{unitShortLabel(o.product.default_unit)}
                      </p>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    {o.priceBasis === "contract" ? (
                      <Badge variant="accent">Your contract price</Badge>
                    ) : null}
                    {o.freshness.ok ? (
                      <Badge variant="success">Current</Badge>
                    ) : (
                      o.freshness.reasons.map((r) => (
                        <Badge key={r} variant="warning">
                          {FRESHNESS_LABEL[r]}
                        </Badge>
                      ))
                    )}
                    <span className="tabular">
                      {o.inventory ? `${o.inventory.packsAvailable} in stock` : "Stock unknown"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="hidden md:block">
        <CardContent className="px-2 pt-2 sm:px-3">
          <Table>
            <TableCaption>
              Prices shown are what {buyer.name} would pay. Stale or missing data is excluded from
              price optimization until the supplier updates it.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right">Your price</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => {
                const displayUnit = o.product.default_unit;
                const unitPrice = table.unitPriceCents(
                  o.priceCents,
                  Number(o.pack.quantity),
                  o.pack.unit,
                  displayUnit,
                );
                return (
                  <TableRow key={o.id}>
                    <TableCell className="min-w-48">
                      <p className="font-medium">{o.product.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {o.product.category} · SKU {o.supplierSku}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {o.pack.label}
                      {o.minPacks > 1 ? (
                        <p className="text-muted-foreground text-xs">Min {o.minPacks} packs</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-nowrap">
                      {formatCents(o.priceCents)}
                      {o.priceBasis === "contract" ? (
                        <p>
                          <Badge variant="accent">Your contract price</Badge>
                        </p>
                      ) : null}
                      {o.priceTiers.map((t) => (
                        <p key={t.min_packs} className="text-muted-foreground text-xs">
                          {formatCents(t.price_cents)} at {t.min_packs}+
                        </p>
                      ))}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-right whitespace-nowrap">
                      {formatUnitPrice(unitPrice)}/{unitShortLabel(displayUnit)}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-nowrap">
                      {o.inventory ? (
                        <>
                          {o.inventory.packsAvailable}
                          <p className="text-muted-foreground text-xs">
                            {formatAge(o.inventory.asOf, source.now)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {o.freshness.ok ? (
                        <Badge variant="success">Current</Badge>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {o.freshness.reasons.map((r) => (
                            <Badge key={r} variant="warning">
                              {FRESHNESS_LABEL[r]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
