/**
 * The shape the AI answers in for one setup document (sent as a structured-output schema).
 * Like the screenshot import, it is a READING only: numbers stay strings as printed, and
 * normalize.ts does every conversion with deterministic code.
 */
import { z } from "zod";

import { extractedLineSchema } from "../vendor-prices/extraction-schema";
import { SETUP_DOC_KINDS } from "./types";

export const setupLineSchema = extractedLineSchema.extend({
  packs_bought: z
    .string()
    .nullable()
    .describe("Invoices only: how many packs were delivered on this line, e.g. '2'. Else null"),
  line_total: z
    .string()
    .nullable()
    .describe("Invoices only: the line's extended amount in dollars, e.g. '53.78'. Else null"),
  on_hand: z
    .string()
    .nullable()
    .describe("Inventory counts only: the amount on hand as printed, e.g. '3' or '2.5'. Else null"),
  on_hand_per: z
    .enum(["unit", "pack"])
    .nullable()
    .describe("'pack' if on_hand counts packs (bags, cases, boxes); 'unit' if a measure unit"),
  on_hand_unit: z
    .string()
    .nullable()
    .describe("When on_hand_per is 'unit': one of the catalog unit codes. Else null"),
  sheet_row: z
    .number()
    .int()
    .nullable()
    .describe("Spreadsheets only: the row number ('Row N') the line was read from. Else null"),
});

export const setupExtractionSchema = z.object({
  document_kind: z.enum(SETUP_DOC_KINDS),
  is_relevant: z
    .boolean()
    .describe("False if it says nothing about items the business buys or keeps in stock"),
  vendor_name: z
    .string()
    .nullable()
    .describe("The supplier selling the items (null for the store's own inventory count)"),
  document_date: z
    .string()
    .nullable()
    .describe(
      "Date printed on it (invoice, quote, message or count date) as YYYY-MM-DD, else null",
    ),
  notes: z
    .string()
    .nullable()
    .describe("One short sentence for the buyer if something is unclear or cut off, else null"),
  lines: z.array(setupLineSchema),
});

export type SetupExtraction = z.infer<typeof setupExtractionSchema>;
export type SetupExtractedLine = z.infer<typeof setupLineSchema>;
