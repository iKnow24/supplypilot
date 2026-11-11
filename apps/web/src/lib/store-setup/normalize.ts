/**
 * Turns what the AI read from one document into lines for review, with deterministic code:
 * units are looked up in the catalog, per-unit prices and pack counts are multiplied out
 * exactly, invoice arithmetic is cross-checked, spreadsheet counts are checked against the cell
 * they came from, and anything doubtful is flagged so the buyer looks at it.
 */
import type { Product, Supplier } from "../catalog/schema";
import { parseQuantity, type CatalogIndex } from "../cart/validation";
import { formatCents } from "../money";
import { unitShortLabel } from "../units";
import { matchSupplier } from "../vendor-prices/match";
import { normalizeLine, MAX_DRAFT_LINES } from "../vendor-prices/normalize";
import { isIsoDate, parseDollars } from "../vendor-prices/parse";
import type { SetupExtraction, SetupExtractedLine } from "./extraction-schema";
import { rowHasNumber } from "./sheet";
import type { DocumentDraft, SetupDocKind, SetupLine } from "./types";

const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n);

/** "0", "12", "2.5", "1,200": a count may be zero, unlike an order quantity. */
export function parseCountValue(input: string): string | null {
  const raw = input.trim().replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,3})?$|^\.\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 100_000 ? String(n) : null;
}

const round3 = (n: number) => String(Math.round(n * 1000) / 1000);

const PRICE_ISSUE = "Check the price";
const PACK_ISSUE = "Check the pack size";

function inventoryLine(
  raw: SetupExtractedLine,
  base: SetupLine,
  index: CatalogIndex,
  sheetRows: string[][] | null,
): SetupLine {
  const issues = base.issues.filter((i) => i !== PRICE_ISSUE && i !== PACK_ISSUE);
  let count = "";
  let countUnit: string | null = null;
  let countReadAs: string | null = null;
  const onHand = raw.on_hand ? parseCountValue(raw.on_hand) : null;

  if (onHand !== null && raw.on_hand_per === "pack") {
    if (base.packQuantity && base.packUnit) {
      count = round3(Number(onHand) * Number(base.packQuantity));
      countUnit = base.packUnit;
      countReadAs = `${onHand} × ${base.packLabel || `${base.packQuantity} ${unitShortLabel(base.packUnit)}`}`;
    } else issues.push("Check the count: how much is in one pack?");
  } else if (onHand !== null) {
    const unit = raw.on_hand_unit ? index.findUnit(raw.on_hand_unit) : undefined;
    if (unit) {
      count = onHand;
      countUnit = unit.code;
    } else issues.push("Check the count's unit");
  } else issues.push("Check the count");

  const product = base.productId ? index.products.get(base.productId) : undefined;
  const unit = countUnit ? index.units.get(countUnit) : undefined;
  if (product && unit && unit.base_unit !== product.base_unit) {
    issues.push(`${product.name} can't be counted in ${unitShortLabel(unit.code)}`);
  }
  // A spreadsheet's numbers are right there: the count must be in the row it came from.
  if (sheetRows && onHand !== null) {
    const row = raw.sheet_row ?? 0;
    if (!rowHasNumber(sheetRows[row - 1], raw.on_hand!)) {
      issues.push(
        row ? `Check the count: row ${row} of the sheet doesn't show it` : "Check the count",
      );
    }
  }

  return {
    ...base,
    priceCents: base.priceCents,
    count,
    countUnit,
    countReadAs,
    confidence: issues.length ? "low" : raw.confidence,
    issues,
  };
}

function invoiceLine(raw: SetupExtractedLine, base: SetupLine): SetupLine {
  const issues = [...base.issues];
  const packsQ = raw.packs_bought ? parseQuantity(raw.packs_bought) : null;
  const packs = packsQ?.ok ? packsQ.value : "";
  const total = raw.line_total ? parseDollars(raw.line_total) : null;
  let { priceCents, readAs } = base;

  if (priceCents === null && total !== null && packs) {
    // Only the extended amount was printed: one pack = total ÷ packs.
    priceCents = Math.round(total / Number(packs));
    readAs = `${formatCents(total)} line total ÷ ${packs}`;
    const at = issues.indexOf(PRICE_ISSUE);
    if (at >= 0) issues.splice(at, 1);
  } else if (priceCents !== null && total !== null && packs) {
    const expected = priceCents * Number(packs);
    if (Math.abs(expected - total) > Math.max(1, Number(packs) / 2)) {
      issues.push(
        `The line total (${formatCents(total)}) isn't ${packs} × ${formatCents(priceCents)}`,
      );
    }
  }
  if (!packs) issues.push("Check how many were bought");

  return {
    ...base,
    priceCents,
    readAs,
    packs,
    confidence: issues.length ? "low" : raw.confidence,
    issues,
  };
}

export function normalizeSetupLine(
  raw: SetupExtractedLine,
  key: string,
  kind: SetupDocKind,
  ctx: { index: CatalogIndex; products: Product[]; sheetRows: string[][] | null },
): SetupLine {
  const priced = normalizeLine(raw, key, ctx.index, ctx.products);
  const base: SetupLine = {
    ...priced,
    packs: "",
    count: "",
    countUnit: null,
    countReadAs: null,
  };
  if (kind === "inventory") return inventoryLine(raw, base, ctx.index, ctx.sheetRows);
  if (kind === "invoice") return invoiceLine(raw, base);
  return base;
}

export function normalizeDocument(
  raw: SetupExtraction,
  ctx: {
    key: string;
    fileName: string;
    index: CatalogIndex;
    products: Product[];
    suppliers: Supplier[];
    /** The parsed cells, when the file was a spreadsheet. */
    sheetRows: string[][] | null;
  },
): DocumentDraft {
  const kind = raw.document_kind;
  const vendorName = kind === "inventory" ? "" : clip(raw.vendor_name, 80);
  const kept = raw.lines.filter(
    (l) => l.description?.trim() || l.price || l.on_hand || l.line_total,
  );
  const lines = kept
    .slice(0, MAX_DRAFT_LINES)
    .map((l, i) => normalizeSetupLine(l, `${ctx.key}-l${i + 1}`, kind, ctx));
  const notes = [
    clip(raw.notes, 300),
    kept.length > MAX_DRAFT_LINES ? `Only the first ${MAX_DRAFT_LINES} lines were kept.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    key: ctx.key,
    fileName: clip(ctx.fileName, 120) || "Document",
    kind,
    vendorName,
    supplierId: vendorName ? matchSupplier(vendorName, ctx.suppliers) : null,
    documentDate: raw.document_date && isIsoDate(raw.document_date) ? raw.document_date : null,
    notes: notes || null,
    lines,
  };
}
