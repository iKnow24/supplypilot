import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import {
  AlternativesTable,
  ExcludedOffers,
  Explanations,
  ProblemsCard,
  QuantityCheck,
  SupplierOrderCard,
  TotalHero,
  type Names,
} from "@/components/results/plan-view";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Best price" };

export default async function ResultPage({ params }: PageProps<"/results/[runId]">) {
  const { runId } = await params;
  const { buyer, persistence, state } = await getSession();
  if (!state) {
    return (
      <div>
        <PageHeader title="Best price" />
        <PersistenceNotice persistence={persistence} />
      </div>
    );
  }
  const repo = getRepository();
  const [run, products, suppliers, source] = await Promise.all([
    state.getRun(runId),
    repo.listProducts(),
    repo.listSuppliers(),
    repo.source(),
  ]);
  if (!run) notFound();

  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const supplierNames = new Map(suppliers.map((s) => [s.id, s.short_name]));
  const names: Names = {
    product: (id) => productNames.get(id) ?? id,
    supplier: (id) => supplierNames.get(id) ?? id,
  };
  const r = run.response;
  const plan = r.recommendation;
  const requested = new Map(
    (plan?.lines ?? []).flatMap((l) =>
      l.allocations.map((a) => [a.offer_id, l.product_id] as const),
    ),
  );
  const ranAt = run.createdAt.toLocaleString("en-US", {
    timeZone: source.timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan ? "Your best price" : "No price for this order"}
        description={
          <>
            {run.lineCount} item{run.lineCount === 1 ? "" : "s"} for {buyer.locations[0]!.name},
            delivered {formatDate(run.deliveryDate, "long")}. Calculated {ranAt}.
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/cart">
              <ArrowLeft aria-hidden /> Back to cart
            </Link>
          </Button>
        }
      />

      {plan ? (
        <>
          <TotalHero
            partial={r.status === "partial"}
            plan={plan}
            baseline={r.baseline}
            savingsCents={r.savings_cents ?? null}
            deliveryDate={run.deliveryDate}
          />
          {r.status === "partial" ? (
            <ProblemsCard problems={r.problems} partial names={names} />
          ) : null}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {plan.suppliers.map((o) => (
                <SupplierOrderCard
                  key={o.supplier_id}
                  order={o}
                  names={names}
                  requested={requested}
                />
              ))}
              <AlternativesTable alternatives={r.alternatives} best={plan} names={names} />
            </div>
            <div className="space-y-6">
              <Explanations items={r.explanations} />
              <QuantityCheck plan={plan} names={names} />
            </div>
          </div>
        </>
      ) : (
        <ProblemsCard problems={r.problems} names={names} />
      )}

      <ExcludedOffers offers={r.excluded_offers} names={names} />
      <p className="text-muted-foreground text-xs">
        {r.data.synthetic ? `${r.data.label}. ` : ""}Prices and stock as of{" "}
        {new Date(r.data.as_of).toLocaleString("en-US", { timeZone: source.timezone })}. Nothing has
        been ordered.
      </p>
    </div>
  );
}
