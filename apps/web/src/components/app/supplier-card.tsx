import { AlertTriangle, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SupplierSummary } from "@/lib/catalog/repository";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/delivery";
import { formatAge } from "@/lib/freshness";
import { formatCents } from "@/lib/money";

export function SupplierCard({
  supplier,
  zone,
  zoneName,
  now,
}: {
  supplier: SupplierSummary;
  zone: string;
  zoneName: string;
  now: Date;
}) {
  const p = supplier.policy;
  const serves = supplier.servesZone(zone);
  return (
    <Card className="h-full transition-shadow hover:shadow-sm">
      <CardContent className="flex h-full flex-col pt-5 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              <Link
                href={`/suppliers/${supplier.id}`}
                className="after:absolute after:inset-0 focus-visible:outline-none"
              >
                {supplier.name}
              </Link>
            </h2>
            <p className="text-muted-foreground text-sm">{supplier.kind}</p>
          </div>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {supplier.synthetic ? <Badge variant="neutral">Demo catalog</Badge> : null}
          {serves ? (
            <Badge variant="success">
              <MapPin aria-hidden /> Delivers to {zoneName}
            </Badge>
          ) : (
            <Badge variant="destructive">
              <MapPin aria-hidden /> Not in {zoneName}
            </Badge>
          )}
          {supplier.flaggedOfferCount > 0 ? (
            <Badge variant="warning">
              <AlertTriangle aria-hidden /> {supplier.flaggedOfferCount} item
              {supplier.flaggedOfferCount === 1 ? "" : "s"} need fresh data
            </Badge>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-muted-foreground">Delivery days</dt>
            <dd className="mt-1 flex gap-1">
              <span className="sr-only">
                {p.delivery_weekdays.map((d) => WEEKDAY_LONG[d]).join(", ")}
              </span>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <span
                  key={d}
                  aria-hidden
                  className={
                    p.delivery_weekdays.includes(d)
                      ? "bg-accent text-accent-foreground rounded-md px-1.5 py-0.5 text-xs font-medium"
                      : "text-muted-foreground rounded-md px-1.5 py-0.5 text-xs line-through"
                  }
                >
                  {WEEKDAY_SHORT[d]}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order minimum</dt>
            <dd className="tabular font-medium">
              {p.min_order_cents ? formatCents(p.min_order_cents) : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivery fee</dt>
            <dd className="tabular font-medium">
              {formatCents(p.delivery_fee_cents)}
              {p.free_delivery_threshold_cents !== null ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · free over {formatCents(p.free_delivery_threshold_cents)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order by</dt>
            <dd className="tabular font-medium">
              {p.cutoff_local_time}, {p.lead_days} day{p.lead_days === 1 ? "" : "s"} before
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prices updated</dt>
            <dd className="tabular font-medium">
              {supplier.latestPriceUpdate ? formatAge(supplier.latestPriceUpdate, now) : "Never"}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-auto pt-4 text-xs">
          {supplier.offerCount} catalog items
        </p>
      </CardContent>
    </Card>
  );
}
