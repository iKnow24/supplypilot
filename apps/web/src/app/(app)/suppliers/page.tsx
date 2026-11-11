import { FileUp, ImageUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { SupplierCard } from "@/components/app/supplier-card";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { getSession } from "@/lib/session";
import { quotedOn } from "@/lib/vendor-prices/parse";
import { vendorKey } from "@/lib/vendor-prices/quotes";

export const metadata: Metadata = { title: "Vendors" };

export default async function SuppliersPage() {
  const repo = getRepository();
  const { buyer, state } = await getSession();
  const [suppliers, source, zones, imports] = await Promise.all([
    repo.listSuppliers(),
    repo.source(),
    repo.zones(),
    state ? state.listPriceImports(200) : [],
  ]);
  // The vendors the store's own documents and screenshots came from, catalog or not.
  const yours = new Map<string, { name: string; catalog: boolean; docs: number; last: string }>();
  for (const imp of imports) {
    const k = vendorKey(imp);
    const on = quotedOn(imp);
    const v = yours.get(k);
    yours.set(k, {
      name: imp.vendorName.replace(" (Demo)", ""),
      catalog: !!imp.supplierId,
      docs: (v?.docs ?? 0) + 1,
      last: v && v.last > on ? v.last : on,
    });
  }
  const zone = buyer.locations[0]!.zone;
  const zoneName = zones.find((z) => z.id === zone)?.name ?? zone;
  return (
    <div>
      <PageHeader
        title="Vendors"
        description={
          <>
            Participating catalogs, delivery schedules and how fresh their data is.{" "}
            {source.synthetic ? "All suppliers below are fictional demo businesses." : null}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/setup">
                <FileUp aria-hidden /> Set up from documents
              </Link>
            </Button>
            <Button asChild>
              <Link href="/suppliers/import">
                <ImageUp aria-hidden /> Add prices from a screenshot
              </Link>
            </Button>
          </>
        }
      />
      {yours.size ? (
        <section aria-labelledby="your-vendors" className="mb-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="your-vendors" className="text-lg font-semibold tracking-tight">
              Your vendors
            </h2>
            <Link
              href="/suppliers/import"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
            >
              See every saved price
            </Link>
          </div>
          <ul className="bg-card shadow-card divide-y rounded-2xl text-sm">
            {[...yours.entries()].map(([k, v]) => (
              <li
                key={k}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <span className="font-medium">{v.name}</span>
                <span className="text-muted-foreground text-xs">
                  {v.catalog ? "In the catalog" : "Your own vendor"} · {v.docs}{" "}
                  {v.docs === 1 ? "document" : "documents"} · latest {formatDate(v.last)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <h2 className="sr-only">Participating suppliers</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <li key={s.id} className="relative">
            <SupplierCard supplier={s} zone={zone} zoneName={zoneName} now={source.now} />
          </li>
        ))}
      </ul>
    </div>
  );
}
