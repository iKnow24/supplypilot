import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileImage,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { StoreItem } from "@/lib/store-setup/types";

/** Home, for a store with nothing tracked yet: start from the documents it already has. */
export function SetupPrompt() {
  return (
    <section
      aria-labelledby="setup-prompt"
      className="wash shadow-card animate-fade-up rounded-3xl p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 id="setup-prompt" className="font-display text-2xl font-medium sm:text-3xl">
            Set up your store from the paperwork you already have
          </h2>
          <p className="text-muted-foreground mt-2 text-[15px]">
            Upload your inventory count, a few recent invoices and your vendors&apos; price sheets
            or texts. We learn your items, vendors, prices and how fast you use things, you check
            it, and Autopilot drafts every order from there. You only approve.
          </p>
          <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <li className="flex items-center gap-1.5">
              <FileSpreadsheet className="size-4" aria-hidden /> Inventory sheet
            </li>
            <li className="flex items-center gap-1.5">
              <FileText className="size-4" aria-hidden /> Invoices (PDF or photo)
            </li>
            <li className="flex items-center gap-1.5">
              <FileImage className="size-4" aria-hidden /> Price sheets and texts
            </li>
          </ul>
        </div>
        <Button asChild size="lg">
          <Link href="/setup">
            Set up from your documents <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Home, right after setup: what was learned, in one line. */
export function SetupDone({ matched, unmatched }: { matched: number; unmatched: number }) {
  return (
    <div role="status" className="bg-success-soft text-success rounded-2xl px-5 py-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Your store is set up with {matched} {matched === 1 ? "item" : "items"}
        {unmatched ? `, plus ${unmatched} not matched yet` : ""}. Autopilot takes it from here.
      </p>
      <p className="mt-1 opacity-90">
        Check your{" "}
        <Link href="/stock" className="underline underline-offset-2">
          stock
        </Link>
        , your{" "}
        <Link href="/lists" className="underline underline-offset-2">
          usual order
        </Link>{" "}
        and your{" "}
        <Link href="/orders" className="underline underline-offset-2">
          past orders
        </Link>
        .
      </p>
    </div>
  );
}

/** Stock: items from setup that aren't in the catalog, so nothing silently disappears. */
export function UnmatchedItems({ items }: { items: StoreItem[] }) {
  const unmatched = items.filter((i) => !i.productId);
  if (!unmatched.length) return null;
  return (
    <section aria-labelledby="unmatched" className="bg-card shadow-card rounded-3xl p-5 sm:p-6">
      <h2 id="unmatched" className="flex items-center gap-2 text-[15px] font-semibold">
        <HelpCircle className="text-warning size-4" aria-hidden />
        Not matched yet ({unmatched.length})
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        From your documents, but not in the SupplyPilot catalog yet, so they aren&apos;t planned or
        priced. We kept them so nothing is lost.
      </p>
      <ul className="mt-3 divide-y text-sm">
        {unmatched.map((i) => (
          <li key={i.id} className="py-2.5">
            <p className="font-medium">{i.name}</p>
            {i.note ? <p className="text-muted-foreground text-xs">{i.note}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
