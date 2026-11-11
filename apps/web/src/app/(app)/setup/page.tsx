import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { StoreSetup } from "@/components/store-setup/store-setup";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";
import { aiConfigured } from "@/lib/vendor-prices/extract";

export const metadata: Metadata = { title: "Set up from your documents" };

export default async function SetupPage() {
  await connection(); // per-request CSP nonce
  const session = await getSession();
  const repo = getRepository();
  const [products, units, suppliers, items] = await Promise.all([
    repo.listProducts(),
    repo.units(),
    repo.listSuppliers(),
    session.state ? session.state.listStoreItems() : Promise.resolve([]),
  ]);

  const disabledReason = !session.state
    ? "Sign in to set up your store."
    : !aiConfigured()
      ? "Reading documents is turned off on this server: it needs an Anthropic API key (ANTHROPIC_API_KEY)."
      : null;

  return (
    <StatusProvider>
      <PageHeader
        eyebrow="Get started"
        title="Set up from your documents"
        description="Upload what you already have: your inventory count, a few weeks of invoices, price sheets and texts from your reps. We read them, you check what we found, and SupplyPilot runs on your own items, vendors and prices."
      />
      <PersistenceNotice persistence={session.persistence} />
      <StoreSetup
        products={products}
        units={units}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, short_name: s.short_name }))}
        disabledReason={disabledReason}
        setUpBefore={items.length > 0}
      />
      <p className="text-muted-foreground mt-6 flex items-start gap-1.5 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Each file is sent to Anthropic&apos;s Claude to read it, then dropped. SupplyPilot
        doesn&apos;t keep your files, only what you approve, visible only to {session.buyer.name}.
      </p>
    </StatusProvider>
  );
}
