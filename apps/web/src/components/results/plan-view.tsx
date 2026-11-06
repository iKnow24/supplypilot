/**
 * Read-only views of an optimizer result. Server components: everything shown comes from the
 * stored response, so a past result looks exactly like it did when it was calculated.
 */
import { CircleAlert, CircleCheck, Info, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import type {
  Alternative,
  Baseline,
  ExcludedOffer,
  Plan,
  Problem,
  SupplierOrder,
} from "@/lib/optimizer/types";
import { unitShortLabel } from "@/lib/units";

export type Names = { product: (id: string) => string; supplier: (id: string) => string };

const BASIS_LABEL = { contract: "Your contract", list: "List price", volume_tier: "Volume price" };

export function TotalHero({
  plan,
  baseline,
  savingsCents,
  deliveryDate,
  partial = false,
}: {
  partial?: boolean;
  plan: Plan;
  baseline: Baseline | null;
  savingsCents: number | null;
  deliveryDate: string;
}) {
  return (
    <section
      aria-labelledby="total-heading"
      className="bg-card rounded-2xl border px-6 py-8 shadow-xs sm:px-10"
    >
      <h2 id="total-heading" className="text-muted-foreground text-sm font-medium">
        Lowest total delivered cost{partial ? " for the items we could include" : ""}
      </h2>
      <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
        {formatCents(plan.total_cents)}
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        {formatCents(plan.items_subtotal_cents)} items +{" "}
        {plan.fees_cents ? `${formatCents(plan.fees_cents)} delivery` : "free delivery"} ·{" "}
        {plan.supplier_count} supplier{plan.supplier_count === 1 ? "" : "s"} · delivered{" "}
        {formatDate(deliveryDate, "long")}
      </p>
      <div className="mt-4">
        <SavingsNote baseline={baseline} savingsCents={savingsCents} />
      </div>
    </section>
  );
}

function SavingsNote({
  baseline,
  savingsCents,
}: {
  baseline: Baseline | null;
  savingsCents: number | null;
}) {
  if (baseline?.status === "priced" && baseline.plan && savingsCents !== null) {
    if (savingsCents > 0) {
      return (
        <Badge variant="success" className="px-3 py-1 text-sm">
          <CircleCheck aria-hidden /> {formatCents(savingsCents)} less than your usual suppliers (
          {formatCents(baseline.plan.total_cents)})
        </Badge>
      );
    }
    if (savingsCents === 0) {
      return <Badge variant="neutral">Same as your usual suppliers</Badge>;
    }
    return (
      <Badge variant="warning">
        Your usual suppliers would be {formatCents(-savingsCents)} cheaper, but you excluded some of
        them
      </Badge>
    );
  }
  return (
    <p className="text-muted-foreground flex gap-2 text-sm">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {baseline?.reason ??
        "No savings shown: load a saved list with your usual suppliers to compare against."}
    </p>
  );
}

export function Explanations({ items }: { items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why this plan</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {items.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function SupplierOrderCard({
  order,
  names,
  requested,
}: {
  order: SupplierOrder;
  names: Names;
  requested: Map<string, string>;
}) {
  const threshold = order.free_delivery_threshold_cents;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Truck className="text-muted-foreground size-4" aria-hidden />
            {order.supplier_name}
          </CardTitle>
          <Badge variant="outline">
            Order by {formatDate(order.order_by.date)}, {formatTime(order.order_by.time)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        <Table>
          <TableCaption className="sr-only">Items from {order.supplier_name}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Packs</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Per pack</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.allocations.map((a) => {
              const asked = requested.get(a.offer_id);
              return (
                <TableRow key={a.offer_id}>
                  <TableCell>
                    <p className="font-medium">{names.product(a.product_id)}</p>
                    <p className="text-muted-foreground text-xs">
                      {a.pack_label}
                      {asked && asked !== a.product_id
                        ? ` · instead of ${names.product(asked)} (approved equivalent)`
                        : ""}
                    </p>
                  </TableCell>
                  <TableCell className="tabular text-right">{a.packs}</TableCell>
                  <TableCell className="tabular hidden text-right sm:table-cell">
                    {formatCents(a.pack_price_cents)}
                    {a.price_basis !== "list" ? (
                      <span className="text-muted-foreground block text-xs">
                        {BASIS_LABEL[a.price_basis]}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular text-right font-medium">
                    {formatCents(a.line_total_cents)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <dl className="mt-3 space-y-1.5 border-t px-2 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items</dt>
            <dd className="tabular">{formatCents(order.items_subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="tabular text-right">
              {order.fee_waived ? (
                <>
                  <span className="text-success font-medium">Free</span>
                  {threshold !== null ? (
                    <span className="text-muted-foreground block text-xs">
                      over {formatCents(threshold)}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {formatCents(order.delivery_fee_cents)}
                  {threshold !== null ? (
                    <span className="text-muted-foreground block text-xs">
                      free from {formatCents(threshold)}
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>
          {order.min_order_cents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Minimum order</dt>
              <dd className="tabular">{formatCents(order.min_order_cents)} ✓</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-medium">
            <dt>Supplier total</dt>
            <dd className="tabular">
              {formatCents(order.items_subtotal_cents + order.delivery_fee_cents)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function QuantityCheck({ plan, names }: { plan: Plan; names: Names }) {
  const over = plan.lines.filter((l) => l.overbuy_quantity !== "0");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What you asked for</CardTitle>
        <CardDescription>
          {over.length
            ? `Pack sizes round ${over.length} item${over.length === 1 ? "" : "s"} up.`
            : "Every item matches exactly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Asked</TableHead>
              <TableHead className="text-right">Getting</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.lines.map((l) => (
              <TableRow key={l.product_id}>
                <TableCell className="font-medium">{names.product(l.product_id)}</TableCell>
                <TableCell className="tabular text-right">
                  {l.requested_quantity} {unitShortLabel(l.unit)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {l.purchased_quantity} {unitShortLabel(l.unit)}
                  {l.overbuy_quantity !== "0" ? (
                    <span className="text-warning block text-xs">+{l.overbuy_quantity} extra</span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AlternativesTable({
  alternatives,
  best,
  names,
}: {
  alternatives: Alternative[];
  best: Plan;
  names: Names;
}) {
  if (!alternatives.length) return null;
  const supplierList = (p: Plan) =>
    p.suppliers.map((s) => names.supplier(s.supplier_id)).join(", ");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other ways to buy it</CardTitle>
        <CardDescription>
          Each is a complete, valid order. The trade-off is spelled out.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        <Table>
          <TableCaption className="sr-only">
            Alternative orders compared to the best price
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Trade-off</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <p className="font-medium">Best price (recommended)</p>
                <p className="text-muted-foreground text-xs">{supplierList(best)}</p>
              </TableCell>
              <TableCell className="tabular text-right font-medium">
                {formatCents(best.total_cents)}
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                Lowest total delivered cost.
              </TableCell>
            </TableRow>
            {alternatives.map((a) => (
              <TableRow key={a.kind}>
                <TableCell>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-muted-foreground text-xs">{supplierList(a.plan)}</p>
                  <p className="text-muted-foreground mt-1 text-xs md:hidden">{a.tradeoff}</p>
                </TableCell>
                <TableCell className="tabular text-right">
                  {formatCents(a.plan.total_cents)}
                  <span className="text-destructive block text-xs">
                    +{formatCents(a.delta_cents)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                  {a.tradeoff}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ProblemsCard({
  problems,
  partial = false,
  names,
}: {
  problems: Problem[];
  partial?: boolean;
  names: Names;
}) {
  const leftOut = [
    ...new Set(
      problems.filter((p) => p.scope === "line" && p.product_id).map((p) => p.product_id!),
    ),
  ];
  return (
    <Card className={partial ? "border-warning/40" : "border-destructive/40"}>
      <CardHeader>
        <CardTitle
          className={`flex items-center gap-2 ${partial ? "text-warning" : "text-destructive"}`}
        >
          <CircleAlert className="size-5" aria-hidden />
          {partial
            ? `${leftOut.length} item${leftOut.length === 1 ? "" : "s"} couldn't be included`
            : "We couldn't build this order"}
        </CardTitle>
        <CardDescription>
          {partial
            ? `The price above covers everything else. Left out: ${leftOut.map(names.product).join(", ")}.`
            : "No combination of suppliers can fill it as asked. Here's exactly what's in the way:"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {problems.map((p, i) => (
            <li key={`${p.code}-${p.product_id ?? p.supplier_id ?? i}`}>{p.message}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ExcludedOffers({ offers, names }: { offers: ExcludedOffer[]; names: Names }) {
  if (!offers.length) return null;
  return (
    <details className="bg-card rounded-xl border px-5 py-4 text-sm">
      <summary className="cursor-pointer font-medium">
        {offers.length} offer{offers.length === 1 ? "" : "s"} couldn&apos;t be used
      </summary>
      <ul className="mt-3 space-y-1.5">
        {offers.map((o) => (
          <li key={o.offer_id}>
            <span className="font-medium">{names.supplier(o.supplier_id)}</span> ·{" "}
            {names.product(o.product_id)}:{" "}
            <span className="text-muted-foreground">
              {o.reasons.map((r) => r.message).join("; ")}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
