import { ImageUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { SupplierCard } from "@/components/app/supplier-card";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getCurrentBuyer } from "@/lib/session";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const repo = getRepository();
  const buyer = await getCurrentBuyer();
  const [suppliers, source, zones] = await Promise.all([
    repo.listSuppliers(),
    repo.source(),
    repo.zones(),
  ]);
  const zone = buyer.locations[0]!.zone;
  const zoneName = zones.find((z) => z.id === zone)?.name ?? zone;
  return (
    <div>
      <PageHeader
        title="Suppliers"
        description={
          <>
            Participating catalogs, delivery schedules and how fresh their data is.{" "}
            {source.synthetic ? "All suppliers below are fictional demo businesses." : null}
          </>
        }
        actions={
          <Button asChild>
            <Link href="/suppliers/import">
              <ImageUp aria-hidden /> Add prices from a screenshot
            </Link>
          </Button>
        }
      />
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
