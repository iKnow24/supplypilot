import { FileText, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";
import { unitShortLabel } from "@/lib/units";
import type { VendorPrice } from "@/lib/vendor-prices/types";

export const metadata: Metadata = { title: "Past orders" };

export default async function OrdersPage() {
  const { persistence, state } = await getSession();
  const [orders, imports, prices, products] = await Promise.all([
    state ? state.listPurchaseOrders({ limit: 100 }) : [],
    state ? state.listPriceImports(200) : [],
    state ? state.listVendorPrices() : [],
    getRepository().listProducts(),
  ]);
  // Before SupplyPilot: the invoices the store uploaded when it set up.
  const invoices = imports
    .filter((i) => i.documentKind === "invoice")
    .sort((a, b) => (b.documentDate ?? "").localeCompare(a.documentDate ?? ""));
  const linesOf = new Map<string, VendorPrice[]>();
  for (const p of prices) linesOf.set(p.importId, [...(linesOf.get(p.importId) ?? []), p]);
  const productName = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div>
      <PageHeader
        title="Past orders"
        description="Purchase orders from the plans you approved, one per supplier."
      />
      {!state ? (
        <PersistenceNotice persistence={persistence} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No purchase orders yet"
          action={
            <Button asChild>
              <Link href="/cart">Start your next order</Link>
            </Button>
          }
        >
          Run Find My Best Price, then approve the plan to create a{" "}
          <strong className="text-foreground font-medium">Draft</strong> PO for each supplier.
          Downloading one marks it <strong className="text-foreground font-medium">Exported</strong>
          . SupplyPilot never sends orders to suppliers or charges you.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-2 pt-2 sm:px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase order</TableHead>
                  <TableHead className="hidden sm:table-cell">Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      <Link href={`/orders/${po.id}`} className="font-medium hover:underline">
                        {po.number}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {po.supplier_name.replace(" (Demo)", "")} · {po.lineCount} item
                        {po.lineCount === 1 ? "" : "s"}
                      </p>
                    </TableCell>
                    <TableCell className="tabular hidden sm:table-cell">
                      {formatDate(po.delivery_date)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatCents(po.total_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={po.status === "exported" ? "success" : "neutral"}>
                        {po.status === "exported" ? "Exported" : "Draft"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {invoices.length ? (
        <section aria-labelledby="invoices" className="mt-10">
          <h2 id="invoices" className="text-lg font-semibold tracking-tight">
            From your invoices
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            What you bought before SupplyPilot, read from the invoices you uploaded. Weekly use and
            your usual order were worked out from these.
          </p>
          <ul className="mt-4 space-y-3">
            {invoices.map((inv) => {
              const lines = linesOf.get(inv.id) ?? [];
              const total = lines.reduce(
                (sum, l) => sum + (l.packs ? Math.round(Number(l.packs) * l.priceCents) : 0),
                0,
              );
              return (
                <li key={inv.id} className="bg-card shadow-card rounded-2xl">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                      <span className="flex min-w-0 items-center gap-3">
                        <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {inv.vendorName.replace(" (Demo)", "")}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Invoice
                            {inv.documentDate
                              ? ` · ${formatDate(inv.documentDate, "long")}`
                              : ""} · {lines.length} {lines.length === 1 ? "item" : "items"}
                          </span>
                        </span>
                      </span>
                      <span className="tabular font-medium">
                        {total ? formatCents(total) : "—"}
                      </span>
                    </summary>
                    <ul className="divide-y border-t px-4 text-sm sm:px-5">
                      {lines.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate">
                              {productName.get(l.productId) ?? l.productId}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {l.packs ? `${l.packs} × ` : ""}
                              {l.packLabel ||
                                `${l.packQuantity} ${unitShortLabel(l.packUnit)}`} at{" "}
                              {formatCents(l.priceCents)}
                            </span>
                          </span>
                          <span className="tabular">
                            {l.packs
                              ? formatCents(Math.round(Number(l.packs) * l.priceCents))
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
