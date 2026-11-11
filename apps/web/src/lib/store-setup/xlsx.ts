/**
 * Reads the first worksheet of an Excel .xlsx file into rows of text, with no dependency: an
 * .xlsx file is a zip of XML parts, and node:zlib inflates them. Only what an inventory sheet
 * needs: shared and inline strings, numbers, booleans. Formulas give their cached value.
 * Bounded so a crafted file (zip bomb, huge sheet) can't exhaust the server.
 */
import "server-only";

import { inflateRawSync } from "node:zlib";

import type { Result } from "../cart/validation";
import { tidy } from "./sheet";

const MAX_ENTRIES = 2000;
const MAX_PART_BYTES = 20_000_000;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function entries(buf: Buffer): Entry[] {
  // End of central directory: the last 22+ bytes (plus an optional comment of up to 64 KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  if (count > MAX_ENTRIES) throw new Error("too many parts");
  let p = buf.readUInt32LE(eocd + 16);
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const nameLen = buf.readUInt16LE(p + 28);
    out.push({
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      localOffset: buf.readUInt32LE(p + 42),
      name: buf.toString("utf8", p + 46, p + 46 + nameLen),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

function readPart(buf: Buffer, e: Entry): string {
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error("bad local header");
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return data.toString("utf8");
  if (e.method !== 8) throw new Error("unsupported compression");
  return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString("utf8");
}

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** All the <t> text inside a fragment (a shared string can be several rich-text runs). */
const texts = (xml: string) =>
  [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]!)).join("");

const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;

function columnIndex(ref: string | null, fallback: number): number {
  const letters = ref?.match(/^[A-Z]+/)?.[0];
  if (!letters) return fallback;
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

function tidyNumber(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return String(Math.round(n * 1e6) / 1e6);
}

export function readXlsx(bytes: Uint8Array): Result<string[][]> {
  try {
    const buf = Buffer.from(bytes);
    const parts = new Map(entries(buf).map((e) => [e.name, e]));
    const part = (name: string) => {
      const e = parts.get(name);
      return e ? readPart(buf, e) : null;
    };

    // The first sheet in the workbook's own order (falls back to sheet1.xml).
    let sheetPath = "xl/worksheets/sheet1.xml";
    const workbook = part("xl/workbook.xml");
    const rels = part("xl/_rels/workbook.xml.rels");
    const firstId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
    if (firstId && rels) {
      const rel = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)]
        .map((m) => m[1]!)
        .find((a) => attr(a, "Id") === firstId);
      const target = rel ? attr(rel, "Target") : null;
      if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    }
    const sheet = part(sheetPath);
    if (!sheet) return { ok: false, error: "That spreadsheet has no sheet we can read" };

    const shared = part("xl/sharedStrings.xml");
    const strings = shared
      ? [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]!))
      : [];

    const rows: string[][] = [];
    for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      let col = 0;
      for (const c of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]!;
        const body = c[2] ?? "";
        col = columnIndex(attr(attrs, "r"), col);
        if (col > 50) break;
        const type = attr(attrs, "t");
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value = "";
        if (type === "s") value = v !== undefined ? (strings[Number(v)] ?? "") : "";
        else if (type === "inlineStr") value = texts(body);
        else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
        else if (type === "str" || type === "e") value = v !== undefined ? decode(v) : "";
        else value = v !== undefined ? tidyNumber(v) : "";
        while (row.length < col) row.push("");
        row[col] = value;
        col++;
      }
      rows.push(row);
    }
    const out = tidy(rows);
    return out.length
      ? { ok: true, value: out }
      : { ok: false, error: "That spreadsheet is empty" };
  } catch {
    return { ok: false, error: "That Excel file couldn't be opened. Try saving it as CSV." };
  }
}
