/**
 * Turns what the AI read into draft lines for review, with deterministic code: units are
 * looked up in the catalog, per-unit prices are multiplied out exactly, and anything that
 * couldn't be read or matched is flagged so the buyer looks at it.
 */
import type { Product, Supplier } from "../catalog/schema";
import { parseQuantity, type CatalogIndex } from "../cart/validation";
import { formatUnitPrice } from "../money";
import { unitShortLabel } from "../units";
import type { Extraction, ExtractedLine } from "./extraction-schema";
import { matchSupplier, suggestProducts } from "./match";
import { isIsoDate, packCentsFromUnitPrice, parseDollars } from "./parse";
import type { DraftLine, PriceDraft } from "./types";

export const MAX_DRAFT_LINES = 100;

const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n);

export function normalizeLine(
  raw: ExtractedLine,
  key: string,
  index: CatalogIndex,
  products: Product[],
): DraftLine {
  const issues: string[] = [];
  const description = clip(raw.description, 200);

  const aiProduct = raw.product_id ? index.products.get(raw.product_id) : undefined;
  const suggestions = [
    ...new Set([...(aiProduct ? [aiProduct.id] : []), ...suggestProducts(description, products)]),
  ].slice(0, 4);
  if (!aiProduct) issues.push("Pick the matching product");

  const unit = raw.pack_unit ? index.findUnit(raw.pack_unit) : undefined;
  const qty = raw.pack_quantity ? parseQuantity(raw.pack_quantity) : null;
  const packQuantity = qty?.ok ? qty.value : "";
  if (!unit || !qty?.ok) issues.push("Check the pack size");
  else if (aiProduct && unit.base_unit !== aiProduct.base_unit) {
    issues.push(`${aiProduct.name} can't be measured in ${unitShortLabel(unit.code)}`);
  }

  let priceCents: number | null = null;
  let readAs: string | null = null;
  if (raw.price) {
    if (raw.price_per === "unit") {
      // A per-unit price ("$0.89/lb") is multiplied out to one pack, exactly.
      const perUnitCents = packCentsFromUnitPrice(raw.price, "100"); // in hundredths of a cent
      if (unit && packQuantity && perUnitCents !== null) {
        priceCents = packCentsFromUnitPrice(raw.price, packQuantity);
        const u = unitShortLabel(unit.code);
        readAs = `${formatUnitPrice(perUnitCents / 100)}/${u} × ${packQuantity} ${u}`;
      }
    } else {
      priceCents = parseDollars(raw.price);
    }
  }
  if (priceCents === null) issues.push("Check the price");

  const packLabel =
    clip(raw.pack_label, 80) ||
    (unit && packQuantity ? `${packQuantity} ${unitShortLabel(unit.code)}` : "");

  return {
    key,
    description: description || "(no description)",
    productId: aiProduct?.id ?? null,
    suggestions,
    packQuantity,
    packUnit: unit?.code ?? null,
    packLabel,
    priceCents,
    readAs,
    // Anything we had to flag is low, whatever the AI thought.
    confidence: issues.length ? "low" : raw.confidence,
    issues,
  };
}

export function normalizeExtraction(
  raw: Extraction,
  ctx: { index: CatalogIndex; products: Product[]; suppliers: Supplier[] },
): PriceDraft {
  const vendorName = clip(raw.vendor_name, 80);
  const lines = raw.lines
    .filter((l) => l.description?.trim() || l.price)
    .slice(0, MAX_DRAFT_LINES)
    .map((l, i) => normalizeLine(l, `l${i + 1}`, ctx.index, ctx.products));
  const notes = [
    clip(raw.notes, 300),
    raw.lines.length > MAX_DRAFT_LINES ? `Only the first ${MAX_DRAFT_LINES} lines were kept.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    vendorName,
    supplierId: vendorName ? matchSupplier(vendorName, ctx.suppliers) : null,
    documentKind: raw.document_kind,
    documentDate: raw.document_date && isIsoDate(raw.document_date) ? raw.document_date : null,
    lines,
    notes: notes || null,
  };
}
