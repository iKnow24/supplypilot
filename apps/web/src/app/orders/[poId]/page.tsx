import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { PurchaseOrderActions } from "@/components/orders/po-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatTime } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Purchase order" };

const BASIS = { contract: "Contract", list: null, volume_tier: "Volume price" } as const;

export default async function PurchaseOrderPage({ params }: PageProps<"/orders/[poId]">) {
  const { poId } = await params;
  const { buyer, persistence, state } = await getSession();
  if (!state) {
    return (
      <div>
        <PageHeader title="Purchase order" />
        <PersistenceNotice persistence={persistence} />
      </div>
    );
  }
  const [po, source] = await Promise.all([state.getPurchaseOrder(poId), getRepository().source()]);
  if (!po) notFound();
  const when = (d: Date) =>
    d.toLocaleString("en-US", {
      timeZone: source.timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <StatusProvider>
      <PageHeader
        title={`Purchase order ${po.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={po.status === "exported" ? "success" : "neutral"}>
              {po.status === "exported" ? "Exported" : "Draft"}
            </Badge>
            Created {when(po.createdAt)}
            {po.exportedAt ? ` · first exported ${when(po.exportedAt)}` : ""}
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/orders">
              <ArrowLeft aria-hidden /> All orders
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <PurchaseOrderActions poId={po.id} isDraft={po.status === "draft"} />

        <Card>
          <CardContent className="space-y-6 pt-6">
            <dl className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  Buyer / deliver to
                </dt>
                <dd className="mt-1">
                  <p className="font-medium">{buyer.name}</p>
                  <p>{po.deliver_to.location_name}</p>
                  <p className="text-muted-foreground">{po.deliver_to.address_label}</p>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">Supplier</dt>
                <dd className="mt-1 font-medium">{po.supplier_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  Delivery date
                </dt>
                <dd className="mt-1">{formatDate(po.delivery_date, "long")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">Order by</dt>
                <dd className="mt-1">
                  {formatDate(po.order_by_date, "long")}, {formatTime(po.order_by_time)}
                </dd>
              </div>
            </dl>

            <Table>
              <TableCaption className="sr-only">Items on purchase order {po.number}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Supplier SKU</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Packs</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Per pack</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((l) => (
                  <TableRow key={l.offer_id}>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">
                      {l.supplier_sku}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{l.product_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {l.pack_label}
                        {BASIS[l.price_basis] ? ` · ${BASIS[l.price_basis]}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="tabular text-right">{l.packs}</TableCell>
                    <TableCell className="tabular hidden text-right sm:table-cell">
                      {formatCents(l.pack_price_cents)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatCents(l.line_total_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="tabular">{formatCents(po.items_subtotal_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular">
                  {po.delivery_fee_cents ? formatCents(po.delivery_fee_cents) : "Free"}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatCents(po.total_cents)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-xs">
          Prices are the ones from{" "}
          <Link href={`/results/${po.runId}`} className="underline">
            the result you approved
          </Link>
          . {source.synthetic ? `${source.label}: fictional supplier, not a real order. ` : ""}
          SupplyPilot doesn&apos;t send POs: download it and send it to the supplier yourself.
        </p>
      </div>
    </StatusProvider>
  );
}
