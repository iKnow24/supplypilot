/**
 * Spreadsheets (inventory counts, order guides), read with plain code. The AI only sees the
 * cells as text to work out which column is which and what each item is; any count it reports
 * is checked against the cell it says it came from.
 */

export const MAX_SHEET_ROWS = 400;
export const MAX_SHEET_COLS = 12;
const MAX_CELL = 80;

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF. Comma, semicolon or tab. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = [",", ";", "\t"]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0]!.d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return tidy(rows);
}

/** Trims cells, drops empty rows and trailing empty columns, and caps the size. */
export function tidy(rows: string[][]): string[][] {
  return rows
    .map((r) => r.slice(0, MAX_SHEET_COLS).map((c) => c.replace(/\s+/g, " ").trim()))
    .map((r) => {
      let end = r.length;
      while (end > 0 && r[end - 1] === "") end--;
      return r.slice(0, end);
    })
    .filter((r) => r.length > 0)
    .slice(0, MAX_SHEET_ROWS);
}

/** The sheet as numbered rows for the AI: "Row 3: AP flour | 3 | bag". */
export function sheetText(rows: string[][]): string {
  return rows
    .map((r, i) => `Row ${i + 1}: ${r.map((c) => c.slice(0, MAX_CELL)).join(" | ")}`)
    .join("\n");
}

/** A cell's number, if the whole cell is one: "3", "2.5", "1,200", "12 lb" -> "12". */
export function cellNumber(cell: string): number | null {
  const m = cell.trim().match(/^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?\s*[a-z#. ]{0,12}$/i);
  if (!m || (!m[1] && !m[2])) return null;
  return Number(`${(m[1] ?? "0").replace(/,/g, "")}${m[2] ?? ""}`);
}

/** True if `value` is (numerically) one of the cells in the row. */
export function rowHasNumber(row: string[] | undefined, value: string): boolean {
  if (!row) return false;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return row.some((c) => {
    const v = cellNumber(c);
    return v !== null && Math.abs(v - n) < 1e-9;
  });
}
