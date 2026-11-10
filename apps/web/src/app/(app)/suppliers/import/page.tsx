import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PageHeader } from "@/components/app/page-header";
import { PersistenceNotice } from "@/components/app/persistence-notice";
import { StatusProvider } from "@/components/cart/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceImport } from "@/components/vendor-prices/price-import";
import { getRepository } from "@/lib/catalog/seed-repository";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";
import { aiConfigured } from "@/lib/vendor-prices/extract";
import { localDay } from "@/lib/vendor-prices/parse";
import { DOCUMENT_KIND_LABEL, type VendorPrice } from "@/lib/vendor-prices/types";

import { deletePriceImport } from "./actions";

export const metadata: Metadata = { title: "Add vendor prices" };

export default async function ImportPricesPage({ searchParams }: PageProps<"/suppliers/import">) {
  await connection(); // per-request CSP nonce
  const [{ saved, deleted, error }, session] = await Promise.all([searchParams, getSession()]);
  const repo = getRepository();
  const [products, units, suppliers] = await Promise.all([
    repo.listProducts(),
    repo.units(),
    repo.listSuppliers(),
  ]);
  const [imports, prices] = session.state
    ? await Promise.all([session.state.listPriceImports(), session.state.listVendorPrices()])
    : [[], []];
  const productById = new Map(products.map((p) => [p.id, p]));
  const byImport = new Map<string, VendorPrice[]>();
  for (const p of prices) byImport.set(p.importId, [...(byImport.get(p.importId) ?? []), p]);
  const justSaved = typeof saved === "string" ? byImport.get(saved) : undefined;

  const disabledReason = !session.state
    ? "Sign in to add vendor prices."
    : !aiConfigured()
      ? "Reading screenshots is turned off on this server: it needs an Anthropic API key (ANTHROPIC_API_KEY)."
      : null;

  return (
    <StatusProvider>
      <Link
        href="/suppliers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Suppliers
      </Link>
      <PageHeader
        eyebrow="Your vendor prices"
        title="Add prices from a screenshot"
        description="Your real prices are negotiated, not public. Upload what your rep sent you: AI reads the lines, you check each one, and the prices you approve show up next to catalog prices, marked as your quote."
      />
      <PersistenceNotice persistence={session.persistence} />

      {typeof error === "string" ? (
        <p
          role="alert"
          className="bg-destructive-soft text-destructive mb-6 rounded-xl px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      {deleted ? (
        <p role="status" className="bg-card shadow-card mb-6 rounded-xl px-4 py-3 text-sm">
          Deleted. Those prices no longer show anywhere.
        </p>
      ) : null}
      {justSaved ? (
        <div
          role="status"
          className="bg-success-soft text-success mb-6 rounded-2xl px-5 py-4 text-sm"
        >
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" aria-hidden /> Saved {justSaved.length}{" "}
            {justSaved.length === 1 ? "price" : "prices"} from {justSaved[0]!.vendorName}.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...new Set(justSaved.map((p) => p.productId))].map((pid) => (
              <li key={pid}>
                <Link
                  href={`/stock/${pid}`}
                  className="bg-card text-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/5 hover:underline"
                >
                  Compare {productById.get(pid)?.name ?? pid}{" "}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PriceImport
        products={products}
        units={units}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, short_name: s.short_name }))}
        disabledReason={disabledReason}
      />

      <p className="text-muted-foreground mt-4 flex items-start gap-1.5 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Your image is sent to Anthropic&apos;s Claude to read it and isn&apos;t stored by
        SupplyPilot. Saved prices are visible only to {session.buyer.name}.
      </p>

      <section aria-labelledby="saved" className="mt-12">
        <h2 id="saved" className="text-lg font-semibold tracking-tight">
          Saved vendor prices
        </h2>
        {imports.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing yet. Prices you approve show up here and on each item&apos;s page.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {imports.map((imp) => {
              const lines = byImport.get(imp.id) ?? [];
              return (
                <li key={imp.id} className="bg-card shadow-card rounded-2xl">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                      <div>
                        <p className="font-medium">{imp.vendorName}</p>
                        <p className="text-muted-foreground text-xs">
                          {DOCUMENT_KIND_LABEL[imp.documentKind]}
                          {imp.documentDate ? ` dated ${formatDate(imp.documentDate)}` : ""} · added{" "}
                          {formatDate(localDay(imp.importedAt))}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {imp.lineCount} {imp.lineCount === 1 ? "price" : "prices"}
                      </Badge>
                    </summary>
                    <div className="border-t px-4 pt-3 pb-4 sm:px-5">
                      <ul className="divide-y text-sm">
                        {lines.map((l) => (
                          <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                            <Link
                              href={`/stock/${l.productId}`}
                              className="min-w-0 hover:underline"
                            >
                              <span className="font-medium">
                                {productById.get(l.productId)?.name ?? l.productId}
                              </span>
                              <span className="text-muted-foreground block text-xs">
                                {l.packLabel} · read as “{l.description}”
                              </span>
                            </Link>
                            <span className="tabular font-medium">{formatCents(l.priceCents)}</span>
                          </li>
                        ))}
                      </ul>
                      <form action={deletePriceImport} className="mt-3">
                        <input type="hidden" name="importId" value={imp.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive -ml-2"
                        >
                          <Trash2 aria-hidden /> Delete these {imp.lineCount} prices
                        </Button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StatusProvider>
  );
}
