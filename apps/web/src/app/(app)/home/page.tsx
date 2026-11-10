import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Package,
  PiggyBank,
  Sparkles,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { loadSavedListAndOpen } from "@/app/(app)/cart/actions";
import { EmptyState } from "@/components/app/empty-state";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate, nextDeliveryDates } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";
import { baselineSuppliers, greeting } from "@/lib/view";

export const metadata: Metadata = { title: "Home" };

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof PiggyBank;
  label: string;
  value: ReactNode;
  hint: ReactNode;
}) {
  return (
    <div className="bg-card shadow-card rounded-2xl p-4 sm:p-5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <span className="bg-accent text-accent-foreground flex size-6 items-center justify-center rounded-md">
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </div>
      <p className="tabular mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{hint}</p>
    </div>
  );
}

function SectionTitle({
  id,
  children,
  action,
}: {
  id: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

export default async function HomePage() {
  const repo = getRepository();
  const { buyer, persistence, state } = await getSession();
  const [source, lists, suppliers, runs, orders] = await Promise.all([
    repo.source(),
    state ? state.listSavedLists() : Promise.resolve([]),
    repo.listSuppliers(),
    state ? state.listRuns(20) : Promise.resolve([]),
    state ? state.listPurchaseOrders({ limit: 4 }) : Promise.resolve([]),
  ]);
  const saved = runs.find((r) => r.savingsCents !== null && r.savingsCents > 0);
  const zone = buyer.locations[0]!.zone;
  const zones = await repo.zones();
  const zoneName = zones.find((z) => z.id === zone)?.name ?? zone;
  const serving = suppliers
    .filter((s) => s.servesZone(zone))
    .map((s) => ({
      s,
      next: nextDeliveryDates(s.policy, zone, source.now, source.timezone, 1)[0],
    }));
  const soonest = serving
    .map((x) => x.next)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="hello"
        className="wash shadow-card animate-fade-up relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-12"
      >
        <div
          aria-hidden
          className="dots absolute inset-y-0 right-0 hidden w-1/2 [mask-image:linear-gradient(to_left,#000,transparent)] opacity-70 lg:block"
        />
        <div className="relative max-w-2xl">
          <p className="text-accent-foreground bg-card/70 inline-flex items-center gap-1.5 rounded-full border border-current/15 px-2.5 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" aria-hidden />
            {buyer.name}
          </p>
          <h1
            id="hello"
            className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[42px] sm:leading-[1.1]"
          >
            {greeting(source.now, source.timezone)}. What do you need to order?
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-[15px] leading-relaxed">
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
        </div>
      </section>

      <section
        aria-labelledby="savings"
        className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <div className="bg-card shadow-card col-span-2 rounded-2xl p-5 lg:col-span-1">
          <h2
            id="savings"
            className="text-muted-foreground flex items-center gap-2 text-xs font-medium"
          >
            <span className="bg-accent text-accent-foreground flex size-6 items-center justify-center rounded-md">
              <PiggyBank className="size-3.5" aria-hidden />
            </span>
            Verified savings
          </h2>
          <p className="tabular mt-3 text-2xl font-semibold tracking-tight">
            {saved ? formatCents(saved.savingsCents!) : "—"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {saved ? (
              <>
                Your latest result for {formatDate(saved.deliveryDate)} beats your usual suppliers
                by this much, delivered.{" "}
                <Link href={`/results/${saved.id}`} className="text-foreground underline">
                  See how
                </Link>
              </>
            ) : (
              "Nothing to show yet. We only report savings measured against your own usual suppliers, never estimates."
            )}
          </p>
        </div>
        <Stat
          icon={ClipboardList}
          label="Saved lists"
          value={lists.length}
          hint={lists.length ? "Ready to reload in one click." : "Save a cart to reuse it weekly."}
        />
        <Stat
          icon={Truck}
          label="Suppliers delivering"
          value={serving.length}
          hint={`To your ${zoneName} location.`}
        />
        <Stat
          icon={CalendarClock}
          label="Soonest delivery"
          value={soonest ? formatDate(soonest) : "—"}
          hint="Based on published schedules and cutoffs."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="lists" className="lg:col-span-2">
          <SectionTitle
            id="lists"
            action={
              <Link
                href="/lists"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                All lists <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Saved weekly lists
          </SectionTitle>
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
                  <Card className="hover:shadow-raised transition-shadow">
                    <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
                      <div className="flex items-center gap-4">
                        <span className="bg-muted text-muted-foreground hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex">
                          <ClipboardList className="size-4.5" aria-hidden />
                        </span>
                        <div>
                          <p className="font-medium">{list.name}</p>
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            {list.lines.length} items · usually bought from{" "}
                            {baselineSuppliers(list, suppliers).join(", ")}
                          </p>
                        </div>
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

        <section aria-labelledby="deliveries">
          <SectionTitle id="deliveries">Delivering to {zoneName}</SectionTitle>
          <Card>
            <CardContent className="pt-2 sm:pt-2">
              <ul className="divide-y text-sm">
                {serving.map(({ s, next }) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="flex items-center gap-2.5 font-medium hover:underline"
                    >
                      <span
                        aria-hidden
                        className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-lg text-[11px] font-semibold"
                      >
                        {s.short_name.slice(0, 2)}
                      </span>
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
              <p className="text-muted-foreground border-t pt-3 pb-1 text-xs">
                Next available delivery, from published demo schedules and cutoffs.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby="recent">
        <SectionTitle
          id="recent"
          action={
            orders.length ? (
              <Link
                href="/orders"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                All orders <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : null
          }
        >
          Recent orders
        </SectionTitle>
        {orders.length === 0 ? (
          <EmptyState icon={Package} title="No purchase orders yet">
            When you approve a recommendation, draft purchase orders for each supplier show up here.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {orders.map((po) => (
              <li key={po.id}>
                <Link
                  href={`/orders/${po.id}`}
                  className="bg-card shadow-card hover:shadow-raised flex items-center justify-between gap-3 rounded-2xl p-4 transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-xl">
                      <Package className="size-4.5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-medium">{po.number}</p>
                      <p className="text-muted-foreground text-xs">
                        {po.supplier_name.replace(" (Demo)", "")} · delivery{" "}
                        {formatDate(po.delivery_date)}
                      </p>
                    </div>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-semibold">
                      {formatCents(po.total_cents)}
                    </span>
                    <Badge variant={po.status === "exported" ? "success" : "neutral"}>
                      {po.status === "exported" ? "Exported" : "Draft"}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
