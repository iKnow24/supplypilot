/**
 * Which files setup accepts, shared by the browser (early feedback) and the server (which
 * trusts only the file's own bytes, never its name or the browser's type).
 */
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  sniffImageType,
  type ImageType,
} from "../vendor-prices/image";

export const MAX_FILES = 12;
export { MAX_IMAGE_BYTES };
/** PDFs are posted to a server action whose body limit is 4 MB. */
export const MAX_PDF_BYTES = 3_500_000;
export const MAX_SHEET_BYTES = 1_000_000;

export type SetupFile =
  { kind: "image"; mediaType: ImageType } | { kind: "pdf" } | { kind: "csv" } | { kind: "xlsx" };

export const ACCEPT = [
  ...IMAGE_TYPES,
  "application/pdf",
  ".pdf",
  "text/csv",
  ".csv",
  ".xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** The browser's best guess, for instant feedback. The server decides from the bytes. */
export function guessFile(name: string, type: string): SetupFile["kind"] | null {
  if ((IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  const e = ext(name);
  if (type === "application/pdf" || e === "pdf") return "pdf";
  if (e === "xlsx") return "xlsx";
  if (e === "csv" || e === "tsv" || type === "text/csv") return "csv";
  if (e === "xls") return null;
  return null;
}

export function sizeLimit(kind: SetupFile["kind"]): number {
  return kind === "image" ? MAX_IMAGE_BYTES : kind === "pdf" ? MAX_PDF_BYTES : MAX_SHEET_BYTES;
}

export const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** What a file really is, from its first bytes (and, for text, its name). */
export function sniffSetupFile(bytes: Uint8Array, name: string): SetupFile | null {
  const image = sniffImageType(bytes);
  if (image) return { kind: "image", mediaType: image };
  const starts = (...b: number[]) => b.every((x, i) => bytes[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { kind: "pdf" }; // %PDF-
  const e = ext(name);
  if (starts(0x50, 0x4b, 0x03, 0x04)) return e === "xlsx" ? { kind: "xlsx" } : null; // a zip
  if ((e === "csv" || e === "tsv" || e === "txt") && looksLikeText(bytes)) return { kind: "csv" };
  return null;
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (bytes.subarray(0, 8000).includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function unsupportedFileMessage(name: string): string {
  return ext(name) === "xls"
    ? `${name}: save it as .xlsx or .csv first`
    : `${name}: use a photo (PNG, JPG, WebP), a PDF, or a CSV or Excel (.xlsx) sheet`;
}
