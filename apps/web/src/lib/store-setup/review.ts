/**
 * The review screen's model: every document's lines merged into one list of the store's items
 * (by catalog product, or by name when nothing matched), plus each vendor document's lines.
 * Pure and deterministic, used by the browser for the review and by tests. On save, the server
 * re-validates everything (validate.ts); nothing here is trusted.
 */
import type { Product, Unit } from "../catalog/schema";
import { UnitTable, unitShortLabel } from "../units";
import { tokens } from "../vendor-prices/match";
import { centsToInput } from "../vendor-prices/parse";
import type { Confidence } from "../vendor-prices/types";
import {
  isPriceDoc,
  type DocumentDraft,
  type PriceDocKind,
  type SetupLine,
  type SetupPayload,
} from "./types";
import { estimateWeekly, roundUse, type Purchase } from "./usage";

export interface ReviewItem {
  key: string;
  /** As the store's documents call it. */
  name: string;
  aiProductId: string | null;
  /** "" = not matched yet. */
  productId: string;
  suggestions: string[];
  /** The unit on hand, weekly use and usual order are in ("" if nothing says). */
  unit: string;
  onHand: string;
  /** Where the count came from: "3 × 50 lb bag · inventory.csv". */
  onHandNote: string | null;
  weekly: string;
  /** How weekly use was worked out, when it came from invoices. */
  weeklyBasis: string | null;
  weeklyCaution: string | null;
  weeklyEdited: boolean;
  usual: string;
  usualEdited: boolean;
  /** Problems with the count, plain English. */
  countIssues: string[];
}

export interface ReviewLine {
  key: string;
  itemKey: string;
  description: string;
  aiProductId: string | null;
  packQuantity: string;
  packUnit: string;
  packLabel: string;
  /** Dollars for one pack, as typed ("" if unknown). */
  price: string;
  /** Packs bought (invoices). */
  packs: string;
  readAs: string | null;
  confidence: Confidence;
  issues: string[];
}

export interface ReviewDoc {
  key: string;
  fileName: string;
  kind: PriceDocKind;
  /** Catalog supplier, or null for one of the store's own vendors (named in vendorName). */
  supplierId: string | null;
  vendorName: string;
  /** YYYY-MM-DD or "". */
  documentDate: string;
  notes: string | null;
  lines: ReviewLine[];
}

export interface Review {
  items: ReviewItem[];
  docs: ReviewDoc[];
  /** Inventory sheets that were read, by file name. */
  counted: string[];
  /** Notes the AI left on inventory sheets. */
  countNotes: string[];
}

export interface ReviewContext {
  byId: Map<string, Product>;
  table: UnitTable;
  units: Map<string, Unit>;
}

export function reviewContext(products: Product[], units: Unit[]): ReviewContext {
  return {
    byId: new Map(products.map((p) => [p.id, p])),
    table: new UnitTable(units),
    units: new Map(units.map((u) => [u.code, u])),
  };
}

const NO_MATCH_ISSUE = "Pick the matching product";
const trim = (n: number) => String(Math.round(n * 1000) / 1000);

export const isCountUnit = (ctx: ReviewContext, code: string) =>
  ctx.units.get(code)?.dimension === "count";

/** q in `from`, expressed in `to`; null when they measure different things. */
function convert(ctx: ReviewContext, q: number, from: string, to: string): number | null {
  const a = ctx.units.get(from);
  const b = ctx.units.get(to);
  if (!a || !b || a.dimension !== b.dimension) return null;
  return ctx.table.convert(q, from, to);
}

export const vendorKey = (d: Pick<ReviewDoc, "supplierId" | "vendorName">) =>
  d.supplierId ?? `name:${d.vendorName.trim().toLowerCase()}`;

function nameKey(description: string): string {
  const t = tokens(description);
  return t.length ? t.join(" ") : description.trim().toLowerCase();
}

export function buildReview(drafts: DocumentDraft[], ctx: ReviewContext): Review {
  const items = new Map<string, ReviewItem>();
  const ensure = (l: SetupLine): ReviewItem => {
    const product = l.productId ? ctx.byId.get(l.productId) : undefined;
    const key = product ? `p:${product.id}` : `n:${nameKey(l.description)}`;
    let item = items.get(key);
    if (!item) {
      item = {
        key,
        name: l.description,
        aiProductId: product?.id ?? null,
        productId: product?.id ?? "",
        suggestions: l.suggestions,
        unit: product?.default_unit ?? l.countUnit ?? l.packUnit ?? "",
        onHand: "",
        onHandNote: null,
        weekly: "",
        weeklyBasis: null,
        weeklyCaution: null,
        weeklyEdited: false,
        usual: "",
        usualEdited: false,
        countIssues: [],
      };
      items.set(key, item);
    }
    return item;
  };

  // Inventory first, so items are named the way the store's own sheet names them.
  const counted: string[] = [];
  const countNotes: string[] = [];
  for (const d of drafts.filter((d) => d.kind === "inventory")) {
    counted.push(d.fileName);
    if (d.notes) countNotes.push(`${d.fileName}: ${d.notes}`);
    for (const l of d.lines) {
      const item = ensure(l);
      item.countIssues.push(...l.issues.filter((i) => i !== NO_MATCH_ISSUE));
      if (!l.count || !l.countUnit) continue;
      if (!item.unit) item.unit = l.countUnit;
      const q = convert(ctx, Number(l.count), l.countUnit, item.unit);
      if (q === null) {
        item.countIssues.push(
          `Counted in ${unitShortLabel(l.countUnit)}: enter it in ${unitShortLabel(item.unit)}`,
        );
        continue;
      }
      item.onHand = trim((item.onHand ? Number(item.onHand) : 0) + q);
      item.onHandNote = [item.onHandNote, [l.countReadAs, d.fileName].filter(Boolean).join(" · ")]
        .filter(Boolean)
        .join("; ");
    }
  }

  const docs: ReviewDoc[] = drafts
    .filter((d): d is DocumentDraft & { kind: PriceDocKind } => isPriceDoc(d.kind))
    .map((d) => ({
      key: d.key,
      fileName: d.fileName,
      kind: d.kind,
      supplierId: d.supplierId,
      vendorName: d.vendorName,
      documentDate: d.documentDate ?? "",
      notes: d.notes,
      lines: d.lines.map((l) => ({
        key: l.key,
        itemKey: ensure(l).key,
        description: l.description,
        aiProductId: l.productId,
        packQuantity: l.packQuantity,
        packUnit: l.packUnit ?? "",
        packLabel: l.packLabel,
        price: l.priceCents === null ? "" : centsToInput(l.priceCents),
        packs: l.packs,
        readAs: l.readAs,
        confidence: l.confidence,
        issues: l.issues.filter((i) => i !== NO_MATCH_ISSUE),
      })),
    }));

  // Matched items first (in the order they were found), then the ones that need a match.
  const list = [...items.values()].sort((a, b) => Number(!a.productId) - Number(!b.productId));
  return recompute({ items: list, docs, counted, countNotes }, ctx);
}

/** Purchases of one item on dated invoices, in the item's unit. */
export function purchasesOf(review: Review, item: ReviewItem, ctx: ReviewContext): Purchase[] {
  if (!item.unit) return [];
  return review.docs
    .filter((d) => d.kind === "invoice" && d.documentDate)
    .flatMap((d) =>
      d.lines
        .filter((l) => l.itemKey === item.key && Number(l.packs) > 0 && Number(l.packQuantity) > 0)
        .flatMap((l) => {
          const q = convert(ctx, Number(l.packs) * Number(l.packQuantity), l.packUnit, item.unit);
          return q === null ? [] : [{ vendorKey: vendorKey(d), date: d.documentDate, quantity: q }];
        }),
    );
}

export function invoiceDates(review: Review): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const d of review.docs) {
    if (d.kind !== "invoice" || !d.documentDate) continue;
    const k = vendorKey(d);
    out.set(k, [...(out.get(k) ?? []), d.documentDate]);
  }
  return out;
}

/** Weekly use and the usual order, re-derived wherever the buyer hasn't typed their own. */
export function recompute(review: Review, ctx: ReviewContext): Review {
  const dates = invoiceDates(review);
  return {
    ...review,
    items: review.items.map((item) => {
      const est = estimateWeekly(purchasesOf(review, item, ctx), dates, unitShortLabel(item.unit));
      const weekly = item.weeklyEdited
        ? item.weekly
        : est
          ? roundUse(est.weekly, isCountUnit(ctx, item.unit))
          : "";
      const usual = item.usualEdited
        ? item.usual
        : weekly && Number(weekly) > 0
          ? String(Math.ceil(Number(weekly) - 1e-9))
          : "";
      return {
        ...item,
        weekly,
        usual,
        weeklyBasis: est?.basis ?? null,
        weeklyCaution: est && !item.weeklyEdited ? est.caution : null,
      };
    }),
  };
}

export function updateItem(
  review: Review,
  key: string,
  patch: Partial<Pick<ReviewItem, "onHand" | "weekly" | "usual">>,
  ctx: ReviewContext,
): Review {
  return recompute(
    {
      ...review,
      items: review.items.map((i) =>
        i.key !== key
          ? i
          : {
              ...i,
              ...patch,
              weeklyEdited: i.weeklyEdited || patch.weekly !== undefined,
              usualEdited: i.usualEdited || patch.usual !== undefined,
              countIssues: patch.onHand !== undefined ? [] : i.countIssues,
            },
      ),
    },
    ctx,
  );
}

/**
 * The buyer picks (or clears) an item's catalog product. If another item already is that
 * product, the two become one: lines move over and counts add up.
 */
export function setItemProduct(
  review: Review,
  key: string,
  productId: string,
  ctx: ReviewContext,
): Review {
  const item = review.items.find((i) => i.key === key);
  if (!item) return review;
  const product = productId ? ctx.byId.get(productId) : undefined;
  if (productId && !product) return review;

  const other = product
    ? review.items.find((i) => i.key !== key && i.productId === product.id)
    : undefined;
  if (other) {
    const q = item.onHand ? convert(ctx, Number(item.onHand), item.unit, other.unit) : null;
    const merged: ReviewItem = {
      ...other,
      onHand: q === null ? other.onHand : trim((other.onHand ? Number(other.onHand) : 0) + q),
      onHandNote: [other.onHandNote, item.onHandNote].filter(Boolean).join("; ") || null,
      countIssues: [...other.countIssues, ...(item.onHand && q === null ? item.countIssues : [])],
      weeklyEdited: false,
      usualEdited: false,
    };
    return recompute(
      {
        ...review,
        items: review.items
          .filter((i) => i.key !== key)
          .map((i) => (i.key === other.key ? merged : i)),
        docs: review.docs.map((d) => ({
          ...d,
          lines: d.lines.map((l) => (l.itemKey === key ? { ...l, itemKey: other.key } : l)),
        })),
      },
      ctx,
    );
  }

  let next: ReviewItem = { ...item, productId };
  if (product && product.default_unit !== item.unit) {
    const to = product.default_unit;
    const conv = (v: string) => {
      if (!v || !item.unit) return v;
      const q = convert(ctx, Number(v), item.unit, to);
      return q === null ? "" : trim(q);
    };
    const lost = !!item.onHand && conv(item.onHand) === "";
    next = {
      ...next,
      unit: to,
      onHand: conv(item.onHand),
      weekly: item.weeklyEdited ? conv(item.weekly) : "",
      usual: item.usualEdited ? conv(item.usual) : "",
      weeklyEdited: item.weeklyEdited && !!conv(item.weekly),
      usualEdited: item.usualEdited && !!conv(item.usual),
      countIssues: lost
        ? [`${product.name} isn't counted in ${unitShortLabel(item.unit)}: enter how much you have`]
        : item.countIssues,
    };
  }
  return recompute({ ...review, items: review.items.map((i) => (i.key === key ? next : i)) }, ctx);
}

export function updateDoc(
  review: Review,
  docKey: string,
  patch: Partial<Pick<ReviewDoc, "supplierId" | "vendorName" | "documentDate" | "kind">>,
  ctx: ReviewContext,
): Review {
  return recompute(
    { ...review, docs: review.docs.map((d) => (d.key === docKey ? { ...d, ...patch } : d)) },
    ctx,
  );
}

export function updateLine(
  review: Review,
  docKey: string,
  lineKey: string,
  patch: Partial<Pick<ReviewLine, "packQuantity" | "packUnit" | "packLabel" | "price" | "packs">>,
  ctx: ReviewContext,
): Review {
  return recompute(
    {
      ...review,
      docs: review.docs.map((d) =>
        d.key !== docKey
          ? d
          : {
              ...d,
              lines: d.lines.map((l) => (l.key === lineKey ? { ...l, ...patch, issues: [] } : l)),
            },
      ),
    },
    ctx,
  );
}

/** Drops a line (and an item nothing else mentions). */
export function removeLine(
  review: Review,
  docKey: string,
  lineKey: string,
  ctx: ReviewContext,
): Review {
  const docs = review.docs
    .map((d) => (d.key !== docKey ? d : { ...d, lines: d.lines.filter((l) => l.key !== lineKey) }))
    .filter((d) => d.lines.length > 0);
  const used = new Set(docs.flatMap((d) => d.lines.map((l) => l.itemKey)));
  const items = review.items.filter(
    (i) => used.has(i.key) || i.onHand || i.onHandNote || i.countIssues.length,
  );
  return recompute({ ...review, docs, items }, ctx);
}

/** What the browser sends to save. */
export function toPayload(
  review: Review,
  supplierName: (id: string) => string | undefined,
): SetupPayload {
  return {
    items: review.items.map((i) => ({
      key: i.key,
      name: i.name,
      productId: i.productId || null,
      unit: i.unit,
      onHand: i.onHand,
      weekly: i.weekly,
      usual: i.usual,
    })),
    documents: review.docs.map((d) => ({
      fileName: d.fileName,
      kind: d.kind,
      vendorName: (d.supplierId ? supplierName(d.supplierId) : undefined) ?? d.vendorName,
      supplierId: d.supplierId,
      documentDate: d.documentDate || null,
      lines: d.lines.map((l) => ({
        itemKey: l.itemKey,
        description: l.description,
        packQuantity: l.packQuantity,
        packUnit: l.packUnit,
        packLabel: l.packLabel,
        price: l.price,
        packs: l.packs,
        confidence: l.confidence,
        aiProductId: l.aiProductId,
      })),
    })),
  };
}
