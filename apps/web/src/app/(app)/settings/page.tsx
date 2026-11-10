import type { Metadata } from "next";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepository } from "@/lib/catalog/seed-repository";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { ResetDemo } from "@/components/app/reset-demo";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { error } = await searchParams;
  const repo = getRepository();
  const [buyers, { buyer, persistence }, source, zones] = await Promise.all([
    repo.listBuyers(),
    getSession(),
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
            Each fictional business has a demo account. Switching signs you in as that business, so
            you only ever see its own cart, saved lists and negotiated prices. Real sign-in replaces
            this before any real buyer uses SupplyPilot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BuyerSwitcher buyers={buyers} currentId={buyer.id} />
          {persistence.status === "ready" ? (
            <p className="text-muted-foreground text-sm">
              Signed in as <span className="font-mono text-xs">{persistence.email}</span>. Carts and
              lists are saved to the database.
            </p>
          ) : (
            <PersistenceNotice persistence={persistence} />
          )}
          <p className="text-muted-foreground text-sm">
            Delivery location: {loc.name} ({zones.find((z) => z.id === loc.zone)?.name}).{" "}
            {loc.address_label}.
          </p>
        </CardContent>
      </Card>
      {persistence.status === "ready" && buyer.synthetic ? (
        <Card>
          <CardHeader>
            <CardTitle>Start the demo fresh</CardTitle>
            <CardDescription>
              Before showing a store, put {buyer.name.replace(" (Demo)", "")} back to how it starts:
              its starting stock and usual list, with no old carts, plans, orders or imported
              prices. Only this demo business is affected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeof error === "string" ? (
              <p
                role="alert"
                className="bg-destructive-soft text-destructive rounded-xl px-4 py-3 text-sm"
              >
                {error}
              </p>
            ) : null}
            <ResetDemo name={buyer.name.replace(" (Demo)", "")} />
          </CardContent>
        </Card>
      ) : null}
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
