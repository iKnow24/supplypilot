import { ClipboardList, Info, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, nextDeliveryDates } from "@/lib/delivery";
import { getCurrentBuyer } from "@/lib/demo-session";
import { UnitTable, formatQuantity } from "@/lib/units";

export const metadata: Metadata = { title: "Smart Cart" };

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const { list: listId } = await searchParams;
  const repo = getRepository();
  const buyer = await getCurrentBuyer();
  const [lists, products, suppliers, units, source] = await Promise.all([
    repo.listSavedLists(buyer.id),
    repo.listProducts(),
    repo.listSuppliers(),
    repo.units(),
    repo.source(),
  ]);
  const table = new UnitTable(units);
  const list = lists.find((l) => l.id === listId);
  const zone = buyer.locations[0]!.zone;
  const earliest = suppliers
    .flatMap((s) => nextDeliveryDates(s.policy, zone, source.now, source.timezone, 1))
    .sort()[0];

  return (
    <div>
      <PageHeader
        title="Smart Cart"
        description="Add what you need. We find the lowest total delivered cost across your suppliers."
      />

      {!list ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          action={
            lists.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {lists.map((l) => (
                  <Button key={l.id} asChild variant="outline">
                    <Link href={`/cart?list=${l.id}`}>
                      <ClipboardList aria-hidden /> Load “{l.name}”
                    </Link>
                  </Button>
                ))}
              </div>
            ) : null
          }
        >
          Start from a saved weekly list. Product search, quantity editing and CSV upload are being
          built next.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{list.name}</CardTitle>
              <CardDescription>
                {list.lines.length} items, loaded from your saved list
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="hidden sm:table-cell">Usually from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.lines.map((line) => {
                    const product = products.find((p) => p.id === line.product_id)!;
                    const supplier = suppliers.find((s) => s.id === line.current_supplier_id);
                    return (
                      <TableRow key={line.product_id}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-muted-foreground text-xs">{product.spec}</p>
                        </TableCell>
                        <TableCell className="tabular text-right whitespace-nowrap">
                          {formatQuantity(Number(line.quantity), table.get(line.unit))}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {supplier?.short_name ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd className="tabular font-medium">{list.lines.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Deliver to</dt>
                    <dd className="font-medium">{buyer.locations[0]!.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Earliest delivery</dt>
                    <dd className="tabular font-medium">{earliest ? formatDate(earliest) : "—"}</dd>
                  </div>
                </dl>
                <Button size="lg" className="w-full" disabled aria-describedby="optimizer-note">
                  Find My Best Price
                </Button>
                <p id="optimizer-note" className="text-muted-foreground flex gap-2 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  The price optimizer isn&apos;t connected in this build yet. We won&apos;t show a
                  price until it is calculated for real.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
