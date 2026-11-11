/**
 * Authoritative check of a reviewed setup before it is saved. Runs on the server; the browser
 * runs the same per-row checks for instant feedback. Every id is checked against the catalog,
 * every number is parsed exactly, and the usage history and usual order are built here.
 */
import { z } from "zod";

import { validateAmount, parseQuantity, type CatalogIndex, type Result } from "../cart/validation";
import type { Product } from "../catalog/schema";
import { addDays, formatDate } from "../delivery";
import { formatCents } from "../money";
import { unitShortLabel } from "../units";
import { daysBetween, isIsoDate, parseDollars } from "../vendor-prices/parse";
import { CONFIDENCES } from "../vendor-prices/types";
import { parseCountValue } from "./normalize";
import {
  SETUP_DOC_KINDS,
  USUAL_LIST_NAME,
  type PriceDocKind,
  type SetupPayload,
  type StoreSetupInput,
} from "./types";
import { MAX_USAGE_WEEKS, mondayOf, weeksCovered } from "./usage";

export const MAX_SETUP_ITEMS = 300;
export const MAX_SETUP_DOCS = 30;
export const MAX_DOC_LINES = 200;

const line = z.object({
  itemKey: z.string().max(200),
  description: z.string().max(400),
  packQuantity: z.string().max(40),
  packUnit: z.string().max(40),
  packLabel: z.string().max(200),
  price: z.string().max(40),
  packs: z.string().max(40),
  confidence: z.string().max(20),
  aiProductId: z.string().max(100).nullable(),
});

const payloadSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().max(200),
        name: z.string().max(400),
        productId: z.string().max(100).nullable(),
        unit: z.string().max(40),
        onHand: z.string().max(40),
        weekly: z.string().max(40),
        usual: z.string().max(40),
      }),
    )
    .max(MAX_SETUP_ITEMS),
  documents: z
    .array(
      z.object({
        fileName: z.string().max(400),
        kind: z.string().max(40),
        vendorName: z.string().max(400),
        supplierId: z.string().max(100).nullable(),
        documentDate: z.string().max(40).nullable(),
        lines: z.array(line).max(MAX_DOC_LINES),
      }),
    )
    .max(MAX_SETUP_DOCS),
}) satisfies z.ZodType<SetupPayload>;

type Item = SetupPayload["items"][number];
type Line = SetupPayload["documents"][number]["lines"][number];

export interface SetupContext {
  index: CatalogIndex;
  suppliers: { id: string; name: string }[];
  /** YYYY-MM-DD, the real calendar day (documents are dated in real life). */
  today: string;
}

const clean = (s: string, n: number) => s.trim().replace(/\s+/g, " ").slice(0, n);

/** Problems with one item's numbers, or null. Only matched items are planned, so only they're checked. */
export function checkItem(item: Item, index: CatalogIndex): string | null {
  if (!item.productId) return null;
  const product = index.products.get(item.productId);
  if (!product) return "Pick the matching product";
  const unit = index.findUnit(item.unit || "?");
  if (!unit || unit.base_unit !== product.base_unit) return "Pick a unit for this item";
  if (item.onHand.trim() && parseCountValue(item.onHand) === null) {
    return "On hand: use a number like 12 or 2.5";
  }
  if (item.weekly.trim() && parseCountValue(item.weekly) === null) {
    return "Weekly use: use a number like 12 or 2.5";
  }
  if (item.usual.trim()) {
    const usual = validateAmount(index, product, item.usual, unit.code);
    if (!usual.ok) return `Usual order: ${usual.error}`;
  }
  return null;
}

/** Problems with one vendor line for a matched item, or null. */
export function checkLine(l: Line, product: Product, index: CatalogIndex): string | null {
  const amount = validateAmount(index, product, l.packQuantity, l.packUnit || "?");
  if (!amount.ok) return l.packUnit ? `Pack: ${amount.error}` : "Pick the pack's unit";
  if (parseDollars(l.price) === null) return "Enter the pack price, like 26.89";
  if (l.packs.trim()) {
    const packs = parseQuantity(l.packs);
    if (!packs.ok) return `Packs bought: ${packs.error}`;
  }
  return null;
}

function checkDate(raw: string | null, today: string): Result<string | null> {
  const d = raw?.trim();
  if (!d) return { ok: true, value: null };
  if (!isIsoDate(d)) return { ok: false, error: "use a real date" };
  if (daysBetween(today, d) > 1) return { ok: false, error: "the date is in the future" };
  if (daysBetween(d, today) > 730) return { ok: false, error: "it's over two years old" };
  return { ok: true, value: d };
}

export function validateSetup(input: unknown, ctx: SetupContext): Result<StoreSetupInput> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That setup couldn't be read. Start over." };
  const p = parsed.data;
  const { index } = ctx;
  const supplierById = new Map(ctx.suppliers.map((s) => [s.id, s]));

  // --- Items -------------------------------------------------------------------------------
  const items = new Map<string, Item & { product: Product | null; name: string; unit: string }>();
  const seenProducts = new Map<string, string>();
  for (const raw of p.items) {
    const name = clean(raw.name, 120) || "(no name)";
    if (items.has(raw.key)) return { ok: false, error: "That setup couldn't be read. Start over." };
    const problem = checkItem(raw, index);
    if (problem) return { ok: false, error: `${name}: ${problem}` };
    const product = raw.productId ? index.products.get(raw.productId)! : null;
    if (product) {
      if (seenProducts.has(product.id)) {
        return {
          ok: false,
          error: `${product.name} is listed twice. Match one to another product.`,
        };
      }
      seenProducts.set(product.id, raw.key);
    }
    const unit = product ? index.findUnit(raw.unit)!.code : raw.unit;
    items.set(raw.key, { ...raw, name, product, unit });
  }
  if (seenProducts.size === 0) {
    return { ok: false, error: "Match at least one item to a product to set up your store." };
  }

  // --- Vendor documents --------------------------------------------------------------------
  const imports: StoreSetupInput["imports"] = [];
  /** Per item: where it was last bought or quoted (for the usual order and the item list). */
  const seen = new Map<
    string,
    { date: string; supplierId: string | null; vendor: string; invoice: boolean; text: string }[]
  >();
  /** Per vendor: invoice dates, for the usage window. */
  const invoiceDates = new Map<string, string[]>();
  /** Per item: vendors it was bought from on invoices. */
  const boughtFrom = new Map<string, Set<string>>();
  let latestInvoice: string | null = null;

  for (const [i, d] of p.documents.entries()) {
    const where = clean(d.fileName, 60) || `Document ${i + 1}`;
    const kind = SETUP_DOC_KINDS.find((k) => k === d.kind && k !== "inventory") as
      PriceDocKind | undefined;
    if (!kind) return { ok: false, error: `${where}: pick what kind of document it is` };
    let supplierId: string | null = null;
    let vendorName = clean(d.vendorName, 80);
    if (d.supplierId !== null) {
      const s = supplierById.get(d.supplierId);
      if (!s) return { ok: false, error: `${where}: unknown supplier` };
      supplierId = s.id;
      vendorName = s.name;
    }
    if (!vendorName) return { ok: false, error: `${where}: name the vendor` };
    const date = checkDate(d.documentDate, ctx.today);
    if (!date.ok) return { ok: false, error: `${where}: ${date.error}` };
    const vKey = supplierId ?? `name:${vendorName.toLowerCase()}`;
    const isInvoice = kind === "invoice";
    if (isInvoice && date.value) {
      invoiceDates.set(vKey, [...(invoiceDates.get(vKey) ?? []), date.value]);
      if (!latestInvoice || date.value > latestInvoice) latestInvoice = date.value;
    }

    const lines: StoreSetupInput["imports"][number]["lines"] = [];
    for (const [j, l] of d.lines.entries()) {
      const item = items.get(l.itemKey);
      if (!item) return { ok: false, error: "That setup couldn't be read. Start over." };
      const at = `${where}, line ${j + 1} (${clean(l.description, 40) || item.name})`;
      const confidence = CONFIDENCES.find((c) => c === l.confidence);
      if (!confidence) return { ok: false, error: `${at}: unknown confidence` };
      const price = parseDollars(l.price);
      const packs = isInvoice && l.packs.trim() ? parseQuantity(l.packs) : null;
      const pack = item.product
        ? validateAmount(index, item.product, l.packQuantity, l.packUnit || "?")
        : null;

      const text = [
        isInvoice && packs?.ok ? `Bought ${packs.value} ×` : isInvoice ? "Bought" : "Quoted",
        clean(l.packLabel, 40) || clean(l.description, 60),
        price !== null ? `at ${formatCents(price)}` : null,
        `from ${vendorName.replace(" (Demo)", "")}`,
        date.value ? `on ${formatDate(date.value)}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      seen.set(l.itemKey, [
        ...(seen.get(l.itemKey) ?? []),
        { date: date.value ?? "", supplierId, vendor: vendorName, invoice: isInvoice, text },
      ]);

      if (!item.product) continue; // kept as a note on the unmatched item
      const problem = checkLine(l, item.product, index);
      if (problem) return { ok: false, error: `${at}: ${problem}` };
      if (pack?.ok && packs?.ok && isInvoice && date.value) {
        boughtFrom.set(l.itemKey, new Set([...(boughtFrom.get(l.itemKey) ?? []), vKey]));
      }
      lines.push({
        product_id: item.product.id,
        description: clean(l.description, 200) || item.product.name,
        pack_quantity: pack!.ok ? pack!.value.quantity : "",
        pack_unit: pack!.ok ? pack!.value.unit : "",
        pack_label:
          clean(l.packLabel, 80) ||
          (pack!.ok ? `${pack!.value.quantity} ${unitShortLabel(pack!.value.unit)}` : ""),
        price_cents: price!,
        confidence,
        mapping_method: l.aiProductId === item.product.id ? "ai_suggested" : "manual",
        packs: packs?.ok ? packs.value : null,
      });
    }
    if (lines.length) {
      imports.push({
        vendor_name: vendorName,
        supplier_id: supplierId,
        document_kind: kind,
        document_date: date.value,
        lines,
      });
    }
  }

  // --- Counts, usage history, usual order, the item list -------------------------------------
  const endWeek = mondayOf(latestInvoice ?? ctx.today);
  const counts: StoreSetupInput["counts"] = [];
  const usage: StoreSetupInput["usage"] = [];
  const usualLines: NonNullable<StoreSetupInput["usual_list"]>["lines"] = [];
  const storeItems: StoreSetupInput["items"] = [];
  const unmatchedNames = new Set<string>();

  for (const item of items.values()) {
    const history = (seen.get(item.key) ?? []).sort(
      (a, b) => Number(a.invoice) - Number(b.invoice) || a.date.localeCompare(b.date),
    );
    const last = history.at(-1);
    if (!item.product) {
      const key = item.name.toLowerCase();
      if (unmatchedNames.has(key)) continue;
      unmatchedNames.add(key);
      const counted =
        item.onHand.trim() && item.unit
          ? `Counted ${parseCountValue(item.onHand) ?? item.onHand} ${unitShortLabel(item.unit)}.`
          : null;
      storeItems.push({
        name: item.name,
        product_id: null,
        vendor_name: last ? clean(last.vendor, 80) : null,
        note:
          [counted, last ? `${last.text}.` : null].filter(Boolean).join(" ").slice(0, 200) || null,
      });
      continue;
    }
    const product = item.product;
    storeItems.push({
      name: item.name,
      product_id: product.id,
      vendor_name: last ? clean(last.vendor, 80) : null,
      note: null,
    });
    const onHand = item.onHand.trim() ? parseCountValue(item.onHand) : null;
    if (onHand !== null) counts.push({ product_id: product.id, quantity: onHand, unit: item.unit });

    const weekly = item.weekly.trim() ? parseCountValue(item.weekly) : null;
    if (weekly !== null && Number(weekly) > 0) {
      const vendors = [...(boughtFrom.get(item.key) ?? [])];
      const weeks = vendors.length
        ? Math.max(...vendors.map((v) => weeksCovered(invoiceDates.get(v) ?? [])))
        : 4;
      for (let k = Math.min(weeks, MAX_USAGE_WEEKS) - 1; k >= 0; k--) {
        usage.push({
          product_id: product.id,
          week_start: addDays(endWeek, -7 * k),
          quantity: weekly,
          unit: item.unit,
        });
      }
    }
    if (item.usual.trim()) {
      const usual = validateAmount(index, product, item.usual, item.unit);
      if (usual.ok) {
        const from = [...history].reverse().find((h) => h.supplierId);
        usualLines.push({
          product_id: product.id,
          quantity: usual.value.quantity,
          unit: usual.value.unit,
          current_supplier_id: from?.supplierId ?? null,
        });
      }
    }
  }

  return {
    ok: true,
    value: {
      items: storeItems,
      imports,
      counts,
      usage,
      usual_list: usualLines.length ? { name: USUAL_LIST_NAME, lines: usualLines } : null,
    },
  };
}
