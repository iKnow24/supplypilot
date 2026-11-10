/**
 * Authoritative check of a reviewed import before it is saved. Runs on the server; the
 * browser's copy is just for instant feedback. Every id is checked against the catalog.
 */
import { z } from "zod";

import { validateAmount, type CatalogIndex, type Result } from "../cart/validation";
import { daysBetween, isIsoDate, parseDollars } from "./parse";
import {
  CONFIDENCES,
  DOCUMENT_KINDS,
  type PriceImportInput,
  type PriceImportPayload,
} from "./types";

export const MAX_IMPORT_LINES = 200;

const payloadSchema = z.object({
  vendorName: z.string(),
  supplierId: z.string().nullable(),
  documentKind: z.string(),
  documentDate: z.string().nullable(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        productId: z.string(),
        packQuantity: z.string(),
        packUnit: z.string(),
        packLabel: z.string(),
        price: z.string(),
        confidence: z.string(),
        mappingMethod: z.string(),
      }),
    )
    .max(MAX_IMPORT_LINES),
}) satisfies z.ZodType<PriceImportPayload>;

export function validatePriceImport(
  input: unknown,
  ctx: { index: CatalogIndex; supplierIds: Set<string>; today: string },
): Result<PriceImportInput> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That import couldn't be read. Start over." };
  const p = parsed.data;

  const vendorName = p.vendorName.trim().replace(/\s+/g, " ");
  if (!vendorName) return { ok: false, error: "Name the vendor these prices are from" };
  if (vendorName.length > 80)
    return { ok: false, error: "Keep the vendor name under 80 characters" };
  if (p.supplierId !== null && !ctx.supplierIds.has(p.supplierId)) {
    return { ok: false, error: "Unknown supplier" };
  }
  const documentKind = DOCUMENT_KINDS.find((k) => k === p.documentKind);
  if (!documentKind) return { ok: false, error: "Pick what kind of document this is" };

  let documentDate: string | null = null;
  if (p.documentDate && p.documentDate.trim()) {
    const d = p.documentDate.trim();
    if (!isIsoDate(d)) return { ok: false, error: "Use a real date for the document" };
    if (daysBetween(ctx.today, d) > 1) {
      return { ok: false, error: "The document date is in the future" };
    }
    if (daysBetween(d, ctx.today) > 730) {
      return { ok: false, error: "That document is over two years old" };
    }
    documentDate = d;
  }

  if (p.lines.length === 0) return { ok: false, error: "Approve at least one line to save" };

  const lines: PriceImportInput["lines"] = [];
  for (const [i, l] of p.lines.entries()) {
    const where = `Line ${i + 1}`;
    const product = ctx.index.products.get(l.productId);
    if (!product) return { ok: false, error: `${where}: pick the matching product` };
    const amount = validateAmount(ctx.index, product, l.packQuantity, l.packUnit);
    if (!amount.ok) return { ok: false, error: `${where}: ${amount.error}` };
    const priceCents = parseDollars(l.price);
    if (priceCents === null) {
      return { ok: false, error: `${where}: enter the pack price, like 26.89` };
    }
    const confidence = CONFIDENCES.find((c) => c === l.confidence);
    if (!confidence) return { ok: false, error: `${where}: unknown confidence` };
    if (l.mappingMethod !== "ai_suggested" && l.mappingMethod !== "manual") {
      return { ok: false, error: `${where}: unknown mapping` };
    }
    const packLabel = l.packLabel.trim().replace(/\s+/g, " ").slice(0, 80);
    lines.push({
      product_id: product.id,
      description: l.description.trim().slice(0, 200) || product.name,
      pack_quantity: amount.value.quantity,
      pack_unit: amount.value.unit,
      pack_label: packLabel || `${amount.value.quantity} ${amount.value.unit.replace("_", " ")}`,
      price_cents: priceCents,
      confidence,
      mapping_method: l.mappingMethod,
    });
  }

  return {
    ok: true,
    value: { vendorName, supplierId: p.supplierId, documentKind, documentDate, lines },
  };
}
