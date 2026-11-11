"use client";

import { CircleAlert, HelpCircle } from "lucide-react";

import type { Product } from "@/lib/catalog/schema";
import type { CatalogIndex } from "@/lib/cart/validation";
import type { ReviewItem } from "@/lib/store-setup/review";
import { checkItem } from "@/lib/store-setup/validate";
import { cn } from "@/lib/utils";

import { AmountInput, ProductSelect } from "./fields";

export type ItemPatch = Partial<Pick<ReviewItem, "onHand" | "weekly" | "usual">>;

const cols =
  "grid gap-x-4 gap-y-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start";

export function itemError(item: ReviewItem, index: CatalogIndex) {
  return checkItem({ ...item, productId: item.productId || null }, index);
}

/** True when an item deserves a second look (shown in amber, counted at the top). */
export function itemNeedsLook(item: ReviewItem, index: CatalogIndex) {
  return (
    !!item.productId &&
    (!!itemError(item, index) || item.countIssues.length > 0 || !!item.weeklyCaution)
  );
}

function Hint({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "warn" | "error";
}) {
  return (
    <p
      className={cn(
        "mt-1 flex items-start gap-1 text-xs",
        tone === "muted" && "text-muted-foreground",
        tone === "warn" && "text-warning",
        tone === "error" && "text-destructive",
      )}
    >
      {tone !== "muted" ? <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> : null}
      <span>{children}</span>
    </p>
  );
}

function MatchedRow({
  item,
  products,
  index,
  onProduct,
  onChange,
}: {
  item: ReviewItem;
  products: Product[];
  index: CatalogIndex;
  onProduct: (productId: string) => void;
  onChange: (patch: ItemPatch) => void;
}) {
  const error = itemError(item, index);
  const look = itemNeedsLook(item, index);
  return (
    <li
      aria-label={item.name}
      className={cn(
        cols,
        "rounded-2xl p-4 ring-1 md:rounded-none md:px-5 md:py-4 md:ring-0",
        look ? "bg-warning-soft/40 ring-warning/20" : "ring-black/5",
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium" title={item.name}>
          {item.name}
        </p>
        <ProductSelect
          className="mt-1.5"
          value={item.productId}
          suggestions={item.suggestions}
          products={products}
          label={`Product for ${item.name}`}
          onChange={onProduct}
        />
        {error ? <Hint tone="error">{error}</Hint> : null}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground mb-1 text-xs font-medium md:sr-only">On hand</p>
        <AmountInput
          label={`On hand of ${item.name}`}
          unit={item.unit}
          value={item.onHand}
          placeholder="Count it"
          onChange={(v) => onChange({ onHand: v })}
        />
        {item.countIssues.map((i) => (
          <Hint key={i} tone="warn">
            {i}
          </Hint>
        ))}
        {!item.countIssues.length && item.onHandNote ? <Hint>{item.onHandNote}</Hint> : null}
        {!item.countIssues.length && !item.onHand ? <Hint>Not on your count sheet</Hint> : null}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground mb-1 text-xs font-medium md:sr-only">Weekly use</p>
        <AmountInput
          label={`Weekly use of ${item.name}`}
          unit={item.unit}
          value={item.weekly}
          onChange={(v) => onChange({ weekly: v })}
        />
        {item.weeklyCaution ? <Hint tone="warn">{item.weeklyCaution}</Hint> : null}
        {item.weeklyBasis && !item.weeklyEdited ? <Hint>{item.weeklyBasis}</Hint> : null}
        {item.weeklyEdited ? <Hint>Your number</Hint> : null}
        {!item.weeklyBasis && !item.weekly ? <Hint>Not on your invoices</Hint> : null}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground mb-1 text-xs font-medium md:sr-only">Usual order</p>
        <AmountInput
          label={`Usual order of ${item.name}`}
          unit={item.unit}
          value={item.usual}
          onChange={(v) => onChange({ usual: v })}
        />
        {item.usual && !item.usualEdited ? <Hint>About a week&apos;s use</Hint> : null}
      </div>
    </li>
  );
}

export function ReviewItems({
  items,
  products,
  index,
  onProduct,
  onChange,
}: {
  items: ReviewItem[];
  products: Product[];
  index: CatalogIndex;
  onProduct: (key: string, productId: string) => void;
  onChange: (key: string, patch: ItemPatch) => void;
}) {
  const matched = items.filter((i) => i.productId);
  const unmatched = items.filter((i) => !i.productId);
  return (
    <section aria-labelledby="setup-items" className="bg-card shadow-card rounded-3xl">
      <div className="p-5 sm:p-6">
        <h2 id="setup-items" className="text-lg font-semibold tracking-tight">
          Your items <span className="text-muted-foreground font-normal">({matched.length})</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          What you stock, matched to products SupplyPilot can price. On hand comes from your count;
          weekly use is what your invoices show you bought, per week. Change anything that&apos;s
          off.
        </p>
      </div>
      <div
        aria-hidden
        className={cn(
          cols,
          "text-muted-foreground hidden border-y px-5 py-2 text-xs font-medium md:grid",
        )}
      >
        <span>Item, as your documents call it</span>
        <span>On hand</span>
        <span>Weekly use</span>
        <span>Usual order</span>
      </div>
      <ul
        aria-label="Your items"
        className="space-y-3 px-4 pb-4 md:space-y-0 md:divide-y md:px-0 md:pb-0"
      >
        {matched.map((item) => (
          <MatchedRow
            key={item.key}
            item={item}
            products={products}
            index={index}
            onProduct={(pid) => onProduct(item.key, pid)}
            onChange={(patch) => onChange(item.key, patch)}
          />
        ))}
      </ul>

      {unmatched.length ? (
        <div className="border-t p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <HelpCircle className="text-warning size-4" aria-hidden />
            Not matched yet ({unmatched.length})
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            These aren&apos;t in the SupplyPilot catalog, or we weren&apos;t sure. Pick the product
            if you see it. Otherwise we keep them on your list so nothing is lost, but can&apos;t
            plan or price them yet.
          </p>
          <ul aria-label="Not matched yet" className="mt-4 grid gap-3 sm:grid-cols-2">
            {unmatched.map((item) => (
              <li key={item.key} className="bg-muted/40 rounded-2xl p-3.5">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <ProductSelect
                  className="mt-1.5"
                  value=""
                  suggestions={item.suggestions}
                  products={products}
                  label={`Product for ${item.name}`}
                  onChange={(pid) => onProduct(item.key, pid)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
