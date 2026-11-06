/**
 * CSV cart import: parse a buyer's spreadsheet into validated cart lines, with an error
 * for every row we can't use. Pure (no I/O) so the browser can preview instantly and the
 * server action can re-run the exact same checks.
 *
 * Columns (header row required, order free, case-insensitive):
 *   product   — product id (prd_...) or exact product name   [required]
 *   quantity  — positive number; leave blank to skip the row  [required column]
 *   unit      — unit code or name (lb, pound, gal, dozen...) [optional: product's default unit]
 * "product_id" / "product_name" / "item" / "qty" are accepted as aliases.
 */
import type { Product } from "../catalog/schema";
import { CatalogIndex, validateAmount } from "./validation";

export const CSV_MAX_BYTES = 256 * 1024;
export const CSV_MAX_ROWS = 500;

export interface CsvLine {
  row: number;
  product_id: string;
  productName: string;
  quantity: string;
  unit: string;
}

export interface CsvRowError {
  /** 1-based line number in the file, counting the header as line 1. */
  row: number;
  message: string;
  raw: string;
}

export interface CsvResult {
  lines: CsvLine[];
  errors: CsvRowError[];
  /** Rows with a product but a blank quantity: "not ordering this week", not an error. */
  skipped: number;
  /** File-level problem (no header, too big...). When set, lines is empty. */
  fatal: string | null;
}

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF/LF, BOM. Returns rows of fields. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const ALIASES: Record<string, "product" | "quantity" | "unit"> = {
  product: "product",
  product_id: "product",
  product_name: "product",
  item: "product",
  name: "product",
  quantity: "quantity",
  qty: "quantity",
  unit: "unit",
  units: "unit",
  uom: "unit",
};

export function parseCartCsv(text: string, index: CatalogIndex): CsvResult {
  const empty = (fatal: string): CsvResult => ({ lines: [], errors: [], skipped: 0, fatal });
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) {
    return empty(`File is larger than ${CSV_MAX_BYTES / 1024} KB`);
  }
  const rows = parseCsvRows(text);
  const header = rows[0];
  if (!header || header.every((h) => !h.trim())) return empty("The file is empty");

  const columns = header.map(
    (h) =>
      ALIASES[
        h
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      ],
  );
  // Prefer an exact product id column if several product columns exist.
  const productCols = columns.flatMap((c, i) => (c === "product" ? [i] : []));
  const productIdCol = header.findIndex((h) => /^product[\s_-]?id$/i.test(h.trim()));
  const productCol = productIdCol >= 0 ? productIdCol : productCols[0];
  const quantityCol = columns.indexOf("quantity");
  const unitCol = columns.indexOf("unit");
  if (productCol === undefined || quantityCol < 0) {
    return empty('Header must include a "product" and a "quantity" column. Download the template.');
  }

  const body = rows.slice(1);
  const dataRows = body.filter((r) => r.some((f) => f.trim() !== ""));
  if (dataRows.length === 0) return empty("No rows under the header");
  if (dataRows.length > CSV_MAX_ROWS) return empty(`More than ${CSV_MAX_ROWS} rows`);

  const lines: CsvLine[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  body.forEach((fields, i) => {
    const row = i + 2;
    if (fields.every((f) => f.trim() === "")) return;
    const raw = fields.join(",");
    const fail = (message: string) => errors.push({ row, message, raw });

    const productInput = (fields[productCol] ?? "").trim();
    if (!productInput) return fail("Missing product");
    const product: Product | undefined = index.findProduct(productInput);
    if (!product) return fail(`Unknown product "${productInput}"`);

    const quantityInput = (fields[quantityCol] ?? "").trim();
    if (!quantityInput) {
      skipped++;
      return;
    }

    const unitInput = unitCol >= 0 ? (fields[unitCol] ?? "").trim() : "";
    const amount = validateAmount(index, product, quantityInput, unitInput || product.default_unit);
    if (!amount.ok) return fail(amount.error);

    const earlier = seen.get(product.id);
    if (earlier !== undefined) return fail(`${product.name} is already on row ${earlier}`);
    seen.set(product.id, row);

    lines.push({
      row,
      product_id: product.id,
      productName: product.name,
      quantity: amount.value.quantity,
      unit: amount.value.unit,
    });
  });

  return { lines, errors, skipped, fatal: null };
}

function csvField(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Template the buyer downloads: header, two example rows, then every product for reference. */
export function cartCsvTemplate(products: Product[]): string {
  const header = "product_id,product_name,quantity,unit";
  const rows = products.map((p) =>
    [p.id, p.name, "", p.default_unit].map((f) => csvField(f)).join(","),
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}
