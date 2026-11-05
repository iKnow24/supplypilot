import type { Metadata } from "next";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getCurrentBuyer } from "@/lib/demo-session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const repo = getRepository();
  const [buyers, buyer, source, zones] = await Promise.all([
    repo.listBuyers(),
    getCurrentBuyer(),
    repo.source(),
    repo.zones(),
  ]);
  const loc = buyer.locations[0]!;
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>Demo business</CardTitle>
          <CardDescription>
            Sign-in isn&apos;t set up yet. Pick one of the fictional businesses to see its saved
            lists and its own negotiated prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BuyerSwitcher buyers={buyers} currentId={buyer.id} />
          <p className="text-muted-foreground text-sm">
            Delivery location: {loc.name} ({zones.find((z) => z.id === loc.zone)?.name}).{" "}
            {loc.address_label}.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>About this data</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            <strong className="text-foreground font-medium">{source.label}.</strong> Dataset{" "}
            <code className="font-mono text-xs">{source.dataset}</code>, market {source.market}.
          </p>
          <p>
            Prices older than {source.priceMaxAgeHours / 24} days and stock counts older than{" "}
            {source.inventoryMaxAgeHours} hours are flagged and left out of price optimization.
          </p>
          <p>
            Demo clock: {source.now.toLocaleString("en-US", { timeZone: source.timezone })} (Orlando
            time).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
