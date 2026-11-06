import { Package } from "lucide-react";
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
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const { persistence, state } = await getSession();
  const orders = state ? await state.listPurchaseOrders({ limit: 100 }) : [];

  return (
    <div>
      <PageHeader
        title="Orders"
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
              <Link href="/cart">Go to Smart Cart</Link>
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
    </div>
  );
}
