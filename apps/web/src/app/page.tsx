import { ArrowRight, ClipboardList, Package, PiggyBank, Truck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, nextDeliveryDates } from "@/lib/delivery";
import { loadSavedListAndOpen } from "@/app/cart/actions";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { getSession } from "@/lib/session";
import { baselineSuppliers, greeting } from "@/lib/view";

export default async function HomePage() {
  const repo = getRepository();
  const { buyer, persistence, state } = await getSession();
  const [source, lists, suppliers] = await Promise.all([
    repo.source(),
    state ? state.listSavedLists() : Promise.resolve([]),
    repo.listSuppliers(),
  ]);
  const zone = buyer.locations[0]!.zone;
  const zones = await repo.zones();
  const zoneName = zones.find((z) => z.id === zone)?.name ?? zone;
  const serving = suppliers
    .filter((s) => s.servesZone(zone))
    .map((s) => ({
      s,
      next: nextDeliveryDates(s.policy, zone, source.now, source.timezone, 1)[0],
    }));

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="hello"
        className="bg-card rounded-2xl border px-6 py-10 shadow-xs sm:px-10 sm:py-14"
      >
        <p className="text-muted-foreground text-sm font-medium">{buyer.name}</p>
        <h1 id="hello" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting(source.now, source.timezone)}. What do you need to order?
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Build one shopping list. We compare every participating supplier on the full delivered
          cost, including fees and minimums, and show you exactly why.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/cart">
              Find My Best Price <ArrowRight aria-hidden />
            </Link>
          </Button>
          {lists[0] ? (
            <form action={loadSavedListAndOpen}>
              <input type="hidden" name="listId" value={lists[0].id} />
              <Button type="submit" size="lg" variant="outline" className="w-full sm:w-auto">
                Start from “{lists[0].name}”
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="lists" className="lg:col-span-2">
          <h2 id="lists" className="mb-3 text-lg font-semibold">
            Saved weekly lists
          </h2>
          {!state ? (
            <PersistenceNotice persistence={persistence} />
          ) : lists.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No saved lists yet">
              Save a cart as a weekly list to reorder it in one click.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {lists.map((list) => (
                <li key={list.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
                      <div>
                        <p className="font-medium">{list.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {list.lines.length} items · usually bought from{" "}
                          {baselineSuppliers(list, suppliers).join(", ")}
                        </p>
                      </div>
                      <form action={loadSavedListAndOpen}>
                        <input type="hidden" name="listId" value={list.id} />
                        <Button type="submit" variant="outline">
                          Open in Smart Cart
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="savings">
          <h2 id="savings" className="mb-3 text-lg font-semibold">
            Verified savings
          </h2>
          <Card>
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex items-center gap-3">
                <PiggyBank className="text-muted-foreground size-5" aria-hidden />
                <p className="tabular text-2xl font-semibold">—</p>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Nothing to show yet. We only report savings measured against your own saved baseline
                order, never estimates.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="recent" className="lg:col-span-2">
          <h2 id="recent" className="mb-3 text-lg font-semibold">
            Recent orders
          </h2>
          <EmptyState icon={Package} title="No purchase orders yet">
            When you approve a recommendation, draft purchase orders for each supplier show up here.
          </EmptyState>
        </section>
        <section aria-labelledby="deliveries">
          <h2 id="deliveries" className="mb-3 text-lg font-semibold">
            Delivering to {zoneName}
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Truck className="text-muted-foreground size-4" aria-hidden />
                Next available delivery
              </CardTitle>
              <CardDescription>Based on published demo schedules and cutoffs.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {serving.map(({ s, next }) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                      {s.short_name}
                    </Link>
                    {next ? (
                      <span className="tabular text-muted-foreground">{formatDate(next)}</span>
                    ) : (
                      <Badge variant="warning">None in 3 weeks</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
