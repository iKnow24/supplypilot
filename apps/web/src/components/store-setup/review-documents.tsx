"use client";

import { ChevronDown, CircleAlert, FileText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Unit } from "@/lib/catalog/schema";
import type { CatalogIndex } from "@/lib/cart/validation";
import { formatDate } from "@/lib/delivery";
import { formatCents } from "@/lib/money";
import type { ReviewDoc, ReviewItem, ReviewLine } from "@/lib/store-setup/review";
import { SETUP_DOC_KINDS, SETUP_DOC_LABEL, type PriceDocKind } from "@/lib/store-setup/types";
import { checkLine } from "@/lib/store-setup/validate";
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";
import { parseDollars } from "@/lib/vendor-prices/parse";

import { field } from "./fields";

export type SupplierOption = { id: string; name: string; short_name: string };
export type LinePatch = Partial<
  Pick<ReviewLine, "packQuantity" | "packUnit" | "packLabel" | "price" | "packs">
>;
export type DocPatch = Partial<
  Pick<ReviewDoc, "supplierId" | "vendorName" | "documentDate" | "kind">
>;

const OTHER = "__other";
const PRICE_KINDS = SETUP_DOC_KINDS.filter((k): k is PriceDocKind => k !== "inventory");

export function lineError(l: ReviewLine, item: ReviewItem | undefined, index: CatalogIndex) {
  const product = item?.productId ? index.products.get(item.productId) : undefined;
  return product ? checkLine({ ...l, aiProductId: l.aiProductId }, product, index) : null;
}

export function lineNeedsLook(l: ReviewLine, item: ReviewItem | undefined, index: CatalogIndex) {
  return !!item?.productId && (l.issues.length > 0 || !!lineError(l, item, index));
}

function DocLine({
  line,
  item,
  invoice,
  index,
  units,
  onChange,
  onRemove,
}: {
  line: ReviewLine;
  item: ReviewItem | undefined;
  invoice: boolean;
  index: CatalogIndex;
  units: Unit[];
  onChange: (patch: LinePatch) => void;
  onRemove: () => void;
}) {
  const product = item?.productId ? index.products.get(item.productId) : undefined;
  const error = lineError(line, item, index);
  const look = lineNeedsLook(line, item, index);
  const unitChoices = product ? units.filter((u) => u.base_unit === product.base_unit) : units;
  const name = product?.name ?? item?.name ?? line.description;
  return (
    <li
      aria-label={line.description}
      className={cn(
        "grid gap-x-3 gap-y-2 px-4 py-3 sm:px-5",
        invoice
          ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto]"
          : "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_auto]",
        look && "bg-warning-soft/40",
        !product && "bg-muted/40",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-muted-foreground truncate text-xs" title={line.description}>
          Read as “{line.description}”{line.readAs ? ` · priced ${line.readAs}` : ""}
        </p>
        {!product ? (
          <Badge variant="warning" className="mt-1">
            Not matched yet: kept as a note
          </Badge>
        ) : null}
        {product
          ? line.issues.map((i) => (
              <p key={i} className="text-warning mt-1 flex items-start gap-1 text-xs">
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {i}
              </p>
            ))
          : null}
        {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
      </div>
      {product ? (
        <>
          <label className="grid min-w-0 content-start gap-1 text-xs font-medium md:block">
            <span className="md:sr-only">Pack</span>
            <span className="flex min-w-0 gap-1.5">
              <input
                aria-label={`Pack size of ${line.description}`}
                inputMode="decimal"
                className={cn(field, "tabular w-20 text-right")}
                value={line.packQuantity}
                onChange={(e) => onChange({ packQuantity: e.target.value, packLabel: "" })}
              />
              <select
                aria-label={`Pack unit of ${line.description}`}
                className={field}
                value={line.packUnit}
                onChange={(e) => onChange({ packUnit: e.target.value, packLabel: "" })}
              >
                <option value="">Unit…</option>
                {unitChoices.map((u) => (
                  <option key={u.code} value={u.code}>
                    {unitShortLabel(u.code)}
                  </option>
                ))}
              </select>
            </span>
            {line.packLabel ? (
              <span className="text-muted-foreground mt-1 block truncate font-normal">
                {line.packLabel}
              </span>
            ) : null}
          </label>
          <label className="grid min-w-0 content-start gap-1 text-xs font-medium md:block">
            <span className="md:sr-only">Price a pack</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">$</span>
              <input
                aria-label={`Price of ${line.description}`}
                inputMode="decimal"
                className={cn(field, "tabular text-right")}
                value={line.price}
                placeholder="0.00"
                onChange={(e) => onChange({ price: e.target.value })}
              />
            </span>
          </label>
          {invoice ? (
            <label className="grid min-w-0 content-start gap-1 text-xs font-medium md:block">
              <span className="md:sr-only">Packs bought</span>
              <input
                aria-label={`Packs bought of ${line.description}`}
                inputMode="decimal"
                className={cn(field, "tabular text-right")}
                value={line.packs}
                placeholder="—"
                onChange={(e) => onChange({ packs: e.target.value })}
              />
            </label>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground text-xs md:col-span-3 md:self-center">
          {[
            line.packLabel,
            line.price ? `$${line.price}` : null,
            line.packs ? `${line.packs} bought` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 justify-self-end"
        aria-label={`Leave out ${line.description}`}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

function DocCard({
  doc,
  items,
  index,
  units,
  suppliers,
  onDoc,
  onLine,
  onRemoveLine,
}: {
  doc: ReviewDoc;
  items: Map<string, ReviewItem>;
  index: CatalogIndex;
  units: Unit[];
  suppliers: SupplierOption[];
  onDoc: (patch: DocPatch) => void;
  onLine: (lineKey: string, patch: LinePatch) => void;
  onRemoveLine: (lineKey: string) => void;
}) {
  const choice = doc.supplierId ?? OTHER;
  const invoice = doc.kind === "invoice";
  const look = doc.lines.filter((l) => lineNeedsLook(l, items.get(l.itemKey), index)).length;
  const missingVendor = !doc.supplierId && !doc.vendorName.trim();
  return (
    <li className="bg-card shadow-card overflow-hidden rounded-3xl">
      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="truncate">{doc.fileName}</span>
          </p>
          <span className="flex gap-1.5">
            <Badge variant="outline">
              {doc.lines.length} {doc.lines.length === 1 ? "line" : "lines"}
            </Badge>
            {look ? <Badge variant="warning">{look} to check</Badge> : null}
          </span>
        </div>
        {doc.notes ? (
          <p className="bg-warning-soft text-warning mt-3 rounded-xl px-3 py-2 text-sm">
            {doc.notes}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
            What it is
            <select
              className={field}
              value={doc.kind}
              onChange={(e) => onDoc({ kind: e.target.value as PriceDocKind })}
            >
              {PRICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SETUP_DOC_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
            Vendor
            <select
              className={cn(field, missingVendor && "border-destructive")}
              value={choice}
              onChange={(e) =>
                onDoc({ supplierId: e.target.value === OTHER ? null : e.target.value })
              }
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={OTHER}>Another vendor (type the name)</option>
            </select>
          </label>
          {!doc.supplierId ? (
            <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
              Vendor name
              <input
                className={cn(field, missingVendor && "border-destructive")}
                value={doc.vendorName}
                maxLength={80}
                placeholder="e.g. Lake Ivanhoe Farms"
                onChange={(e) => onDoc({ vendorName: e.target.value })}
              />
            </label>
          ) : null}
          <label className="grid min-w-0 content-start gap-1 text-xs font-medium">
            {invoice ? "Invoice date" : "Date on it"}
            <input
              type="date"
              className={field}
              value={doc.documentDate}
              onChange={(e) => onDoc({ documentDate: e.target.value })}
            />
          </label>
        </div>
        {invoice && !doc.documentDate ? (
          <p className="text-warning mt-2 text-xs">
            Add the invoice date so it counts toward weekly use.
          </p>
        ) : null}
      </div>
      <details open={look > 0 || doc.lines.length <= 2} className="group">
        <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm group-open:border-b sm:px-5">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          <span className="group-open:hidden">
            Show the {doc.lines.length} {doc.lines.length === 1 ? "line" : "lines"} we read
            {look ? "" : " · nothing to check"}
          </span>
          <span className="hidden group-open:inline">Lines we read</span>
        </summary>
        <div
          aria-hidden
          className={cn(
            "text-muted-foreground hidden gap-x-3 border-b px-5 py-2 text-xs font-medium md:grid",
            invoice
              ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_2.25rem]"
              : "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_2.25rem]",
          )}
        >
          <span>Item</span>
          <span>Pack</span>
          <span>Price a pack</span>
          {invoice ? <span>Packs bought</span> : null}
          <span />
        </div>
        <ul aria-label={`Lines from ${doc.fileName}`} className="divide-y">
          {doc.lines.map((l) => (
            <DocLine
              key={l.key}
              line={l}
              item={items.get(l.itemKey)}
              invoice={invoice}
              index={index}
              units={units}
              onChange={(patch) => onLine(l.key, patch)}
              onRemove={() => onRemoveLine(l.key)}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function ReviewDocuments(props: {
  docs: ReviewDoc[];
  items: ReviewItem[];
  index: CatalogIndex;
  units: Unit[];
  suppliers: SupplierOption[];
  onDoc: (docKey: string, patch: DocPatch) => void;
  onLine: (docKey: string, lineKey: string, patch: LinePatch) => void;
  onRemoveLine: (docKey: string, lineKey: string) => void;
}) {
  const items = new Map(props.items.map((i) => [i.key, i]));
  const vendors = new Set(props.docs.map((d) => d.supplierId ?? d.vendorName.trim().toLowerCase()));
  return (
    <section aria-labelledby="setup-vendors">
      <h2 id="setup-vendors" className="text-lg font-semibold tracking-tight">
        Vendors and prices{" "}
        <span className="text-muted-foreground font-normal">
          ({vendors.size} {vendors.size === 1 ? "vendor" : "vendors"})
        </span>
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Each document&apos;s prices are saved as your quote from that vendor, dated by the document.
        Leave out any line that&apos;s wrong.
      </p>
      <ul className="mt-4 space-y-4">
        {props.docs.map((d) => (
          <DocCard
            key={d.key}
            doc={d}
            items={items}
            index={props.index}
            units={props.units}
            suppliers={props.suppliers}
            onDoc={(patch) => props.onDoc(d.key, patch)}
            onLine={(lineKey, patch) => props.onLine(d.key, lineKey, patch)}
            onRemoveLine={(lineKey) => props.onRemoveLine(d.key, lineKey)}
          />
        ))}
      </ul>
    </section>
  );
}

/** Invoices, read-only: what was bought, from whom, when. */
export function PastOrders({
  docs,
  suppliers,
}: {
  docs: ReviewDoc[];
  suppliers: SupplierOption[];
}) {
  const invoices = docs
    .filter((d) => d.kind === "invoice")
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate));
  if (invoices.length === 0) return null;
  const name = (d: ReviewDoc) =>
    (suppliers.find((s) => s.id === d.supplierId)?.name ?? d.vendorName).replace(" (Demo)", "") ||
    "Unknown vendor";
  return (
    <section aria-labelledby="setup-past" className="bg-card shadow-card rounded-3xl p-5 sm:p-6">
      <h2 id="setup-past" className="text-lg font-semibold tracking-tight">
        Past orders <span className="text-muted-foreground font-normal">({invoices.length})</span>
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        From your invoices. They&apos;re how weekly use is worked out, and they show under Orders →
        Past orders.
      </p>
      <ul aria-label="Past orders from your invoices" className="mt-4 divide-y text-sm">
        {invoices.map((d) => {
          const total = d.lines.reduce((sum, l) => {
            const price = parseDollars(l.price);
            return price !== null && Number(l.packs) > 0 ? sum + price * Number(l.packs) : sum;
          }, 0);
          return (
            <li key={d.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{name(d)}</span>
                <span className="text-muted-foreground text-xs">
                  {d.documentDate ? formatDate(d.documentDate, "long") : "No date"} ·{" "}
                  {d.lines.length} {d.lines.length === 1 ? "item" : "items"}
                </span>
              </span>
              <span className="tabular font-medium">
                {total ? formatCents(Math.round(total)) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
