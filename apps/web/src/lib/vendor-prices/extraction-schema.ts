/**
 * The shape the AI must answer in (sent as a structured-output JSON schema). It is only a
 * READING of the image: numbers stay strings as printed, and normalize.ts turns them into
 * cents and catalog units with deterministic code.
 */
import { z } from "zod";

import { CONFIDENCES, DOCUMENT_KINDS } from "./types";

export const extractedLineSchema = z.object({
  description: z.string().describe("The item as printed, e.g. 'AP Flour Unbleached 50#'"),
  product_id: z
    .string()
    .nullable()
    .describe("The catalog product id this item is, or null if none fits"),
  pack_quantity: z
    .string()
    .nullable()
    .describe("Amount in one pack, as a plain decimal like '50' or '2.5'. Null if not shown"),
  pack_unit: z
    .string()
    .nullable()
    .describe("Unit of pack_quantity: one of the catalog unit codes. Null if not shown"),
  pack_label: z
    .string()
    .nullable()
    .describe("How the pack is described, e.g. '50 lb bag', 'case of 15 dozen'"),
  price: z
    .string()
    .nullable()
    .describe("The price as a plain decimal in US dollars, e.g. '26.89'. Null if not shown"),
  price_per: z
    .enum(["pack", "unit"])
    .describe("'pack' if price is for one whole pack; 'unit' if it is per pack_unit (e.g. per lb)"),
  confidence: z
    .enum(CONFIDENCES)
    .describe("high: clearly printed and matched; medium: some guessing; low: hard to read"),
});

export const extractionSchema = z.object({
  is_price_document: z
    .boolean()
    .describe("False if the image shows no supplier prices at all (a photo of a cat, a menu...)"),
  vendor_name: z.string().nullable().describe("The supplier/vendor selling these items"),
  document_kind: z.enum(DOCUMENT_KINDS),
  document_date: z
    .string()
    .nullable()
    .describe("Date on the document as YYYY-MM-DD (quote, invoice or message date), else null"),
  notes: z
    .string()
    .nullable()
    .describe("One short sentence for the buyer if something is unclear or cut off, else null"),
  lines: z.array(extractedLineSchema),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedLine = z.infer<typeof extractedLineSchema>;
