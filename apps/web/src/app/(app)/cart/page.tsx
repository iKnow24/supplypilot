import { ClipboardList, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { CartToolbar } from "@/components/cart/cart-toolbar";
import { CartWorkspace } from "@/components/cart/cart-workspace";
import { CsvImport } from "@/components/cart/csv-import";
import { FindBestPriceButton } from "@/components/cart/find-best-price-button";
import { DeliveryDatePicker, type DateOptionView } from "@/components/cart/delivery-date-picker";
import { StatusProvider } from "@/components/cart/status";
import { SupplierPreferences } from "@/components/cart/supplier-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierPreference } from "@/lib/buyer-state/repository";
import { deliveryOptions } from "@/lib/cart/delivery-options";
import { copyName } from "@/lib/cart/names";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, formatTime } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";

import { loadSavedListAndOpen } from "./actions";

export const metadata: Metadata = { title: "Next order" };

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const { error, from } = await searchParams;
  const repo = getRepository();
  const { buyer, persistence, state } = await getSession();
  const [products, units, suppliers, source] = await Promise.all([
    repo.listProducts(),
    repo.units(),
    repo.listSuppliers(),
    repo.source(),
  ]);

  if (!state) {
    return (
      <div>
        <PageHeader title="Next order" />
        <PersistenceNotice persistence={persistence} />
        <EmptyState icon={ShoppingCart} title="Your cart needs the database">
          Carts and saved lists are stored per business in the database, so they stay private and
          survive a refresh. Once it&apos;s connected, you can search products, edit quantities,
          upload a CSV and pick a delivery date here.
        </EmptyState>
      </div>
    );
  }

  const [cart, favorites, lists, runs] = await Promise.all([
    state.getCart(),
    state.listFavorites(),
    state.listSavedLists(),
    state.listRuns(1),
  ]);
  const lastRun = runs[0];
  const location = buyer.locations[0]!;
  const supplierNames = Object.fromEntries(suppliers.map((s) => [s.id, s.short_name]));
  const excluded = new Set(cart.excludedSupplierIds);
  const preferred = new Set(cart.preferredSupplierIds);

  const options: DateOptionView[] = deliveryOptions(
    suppliers,
    location.zone,
    source.now,
    source.timezone,
    excluded,
  ).map((o) => ({
    date: o.date,
    availableCount: o.available.length,
    suppliers: o.checks.map((c) => ({
      id: c.supplierId,
      name: supplierNames[c.supplierId] ?? c.supplierId,
      ok: c.check.ok,
      excluded: c.excluded,
      detail: c.check.ok
        ? `Order by ${formatDate(c.check.orderBy.date)}, ${formatTime(c.check.orderBy.time)}`
        : c.check.message,
    })),
  }));
  const selected = options.find((o) => o.date === cart.deliveryDate);
  const baseline = lists.find((l) => l.id === cart.sourceListId);
  const takenNames = new Set(lists.map((l) => l.name));
  const wantedName = baseline?.name ?? "Weekly order";
  const defaultListName = takenNames.has(wantedName)
    ? copyName(wantedName, takenNames)
    : wantedName;

  const preferenceRows = suppliers.map(
    (s): { id: string; name: string; preference: SupplierPreference } => ({
      id: s.id,
      name: s.short_name,
      preference: preferred.has(s.id) ? "preferred" : excluded.has(s.id) ? "excluded" : "neutral",
    }),
  );

  return (
    <StatusProvider>
      <PageHeader
        title="Next order"
        description="Add what you need. We find the lowest total delivered cost across your suppliers."
        actions={<CartToolbar defaultName={defaultListName} hasLines={cart.lines.length > 0} />}
      />
      {from === "stock" && cart.lines.length ? (
        <p
          role="status"
          className="bg-accent text-accent-foreground mb-6 rounded-xl px-4 py-3 text-sm"
        >
          Drafted from your stock levels. Check the amounts, then Find My Best Price to compare
          suppliers.
        </p>
      ) : null}
      {typeof error === "string" ? (
        <p
          role="alert"
          className="bg-destructive-soft text-destructive mb-6 rounded-xl px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your list</CardTitle>
              <CardDescription>
                {cart.lines.length} item{cart.lines.length === 1 ? "" : "s"}
                {baseline ? <> · loaded from “{baseline.name}”</> : null}. Changes save
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CartWorkspace
                products={products}
                units={units}
                lines={cart.lines}
                favorites={favorites}
                supplierNames={supplierNames}
              />
            </CardContent>
          </Card>

          {lists.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="text-muted-foreground size-4" aria-hidden />
                  Start from a saved list
                </CardTitle>
                <CardDescription>
                  Loading a list replaces what&apos;s in the cart and sets it as your baseline.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {lists.map((l) => (
                  <form key={l.id} action={loadSavedListAndOpen}>
                    <input type="hidden" name="listId" value={l.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Load “{l.name}” ({l.lines.length})
                    </Button>
                  </form>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload a CSV</CardTitle>
              <CardDescription>
                Paste your order from a spreadsheet. We check every row before anything changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CsvImport products={products} units={units} cartHasLines={cart.lines.length > 0} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Items</dt>
                  <dd className="tabular font-medium">{cart.lines.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Deliver to</dt>
                  <dd className="text-right font-medium">{location.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Delivery date</dt>
                  <dd className="tabular font-medium">
                    {selected ? formatDate(selected.date) : "Not set"}
                  </dd>
                </div>
                {selected ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Suppliers that day</dt>
                    <dd className="tabular font-medium">{selected.availableCount}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Baseline</dt>
                  <dd className="text-right font-medium">{baseline ? baseline.name : "None"}</dd>
                </div>
              </dl>
              <FindBestPriceButton
                blockedReason={
                  cart.lines.length === 0
                    ? "Add something to your cart first."
                    : !selected
                      ? "Pick a delivery date to compare prices."
                      : null
                }
              />
              {lastRun ? (
                <p className="text-muted-foreground text-xs">
                  Last result:{" "}
                  <Link href={`/results/${lastRun.id}`} className="text-foreground underline">
                    {lastRun.totalCents !== null
                      ? formatCents(lastRun.totalCents)
                      : "couldn't be built"}{" "}
                    for {formatDate(lastRun.deliveryDate)}
                  </Link>{" "}
                  ·{" "}
                  <Link href="/results" className="underline">
                    All results
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 sm:pt-6">
              <DeliveryDatePicker options={options} selected={cart.deliveryDate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suppliers</CardTitle>
              <CardDescription>
                Choose who you&apos;re willing to buy from for this order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierPreferences suppliers={preferenceRows} />
            </CardContent>
          </Card>
        </div>
      </div>
    </StatusProvider>
  );
}
