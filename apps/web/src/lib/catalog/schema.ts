/**
 * Runtime schema for the shared catalog file (data/seed/demo_catalog.json).
 *
 * Mirrors the Pydantic models in services/optimizer/src/supplypilot_optimizer/catalog.py.
 * Both sides validate the same file, so a contract drift fails a test on
 * whichever side is out of date. See docs/api-contract.md.
 */
import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const decimal = z.string().regex(/^\d+(\.\d+)?$/, "Expected a positive decimal string");
const isoDateTime = z.string().datetime({ offset: true });
const baseUnit = z.enum(["g", "ml", "each"]);

export const unitSchema = z.strictObject({
  code: z.string(),
  label: z.string(),
  dimension: z.enum(["mass", "volume", "count"]),
  base_unit: baseUnit,
  to_base: decimal,
});

export const deliveryPolicySchema = z.strictObject({
  zones: z.array(z.string()),
  delivery_weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  cutoff_local_time: hhmm,
  lead_days: z.number().int().min(0),
  delivery_window: z.strictObject({ start: hhmm, end: hhmm }),
  min_order_cents: z.number().int().min(0),
  delivery_fee_cents: z.number().int().min(0),
  free_delivery_threshold_cents: z.number().int().min(0).nullable(),
});

export const supplierSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  kind: z.string(),
  description: z.string(),
  policy: deliveryPolicySchema,
  synthetic: z.boolean(),
});

export const productSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  base_unit: baseUnit,
  default_unit: z.string(),
  spec: z.string(),
});

export const offerSchema = z.strictObject({
  id: z.string(),
  supplier_id: z.string(),
  product_id: z.string(),
  supplier_sku: z.string(),
  pack: z.strictObject({ quantity: decimal, unit: z.string(), label: z.string() }),
  list_price_cents: z.number().int().min(0),
  min_packs: z.number().int().min(1),
  price_tiers: z.array(
    z.strictObject({ min_packs: z.number().int().min(1), price_cents: z.number().int().min(0) }),
  ),
  price_updated_at: isoDateTime,
  inventory: z
    .strictObject({ packs_available: z.number().int().min(0), as_of: isoDateTime })
    .nullable(),
  mapping: z.strictObject({
    method: z.enum(["supplier_provided", "manual", "ai_suggested"]),
    reviewed: z.boolean(),
  }),
  source: z.strictObject({
    type: z.enum(["synthetic_seed", "csv_import", "api", "edi", "email"]),
    import_id: z.string(),
  }),
  synthetic: z.boolean(),
});

const listLineSchema = z.strictObject({
  product_id: z.string(),
  quantity: decimal,
  unit: z.string(),
  current_supplier_id: z.string().nullable(),
});

export const buyerSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["bakery", "cafe", "restaurant"]),
  synthetic: z.boolean(),
  locations: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      zone: z.string(),
      address_label: z.string(),
    }),
  ),
  approved_equivalences: z.array(z.string()),
  contract_prices: z.array(
    z.strictObject({
      supplier_id: z.string(),
      product_id: z.string(),
      price_cents: z.number().int().min(0),
    }),
  ),
  saved_lists: z.array(
    z.strictObject({ id: z.string(), name: z.string(), lines: z.array(listLineSchema) }),
  ),
});

export const catalogSchema = z.strictObject({
  meta: z.strictObject({
    dataset: z.string(),
    synthetic: z.boolean(),
    label: z.string(),
    currency: z.literal("USD"),
    timezone: z.string(),
    market: z.string(),
    reference_now: isoDateTime,
    freshness_policy: z.strictObject({
      price_max_age_hours: z.number().int(),
      inventory_max_age_hours: z.number().int(),
      on_stale: z.literal("exclude_and_flag"),
      on_missing_inventory: z.literal("exclude_and_flag"),
    }),
  }),
  catalog_imports: z.array(
    z.strictObject({
      id: z.string(),
      source_type: z.string(),
      description: z.string(),
      imported_at: isoDateTime,
      supplier_ids: z.array(z.string()),
    }),
  ),
  units: z.array(unitSchema),
  zones: z.array(z.strictObject({ id: z.string(), name: z.string() })),
  suppliers: z.array(supplierSchema),
  products: z.array(productSchema),
  equivalences: z.array(
    z.strictObject({
      id: z.string(),
      product_ids: z.array(z.string()).min(2),
      note: z.string(),
      requires_buyer_approval: z.boolean(),
    }),
  ),
  offers: z.array(offerSchema),
  buyers: z.array(buyerSchema),
  scenarios: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      buyer_id: z.string(),
      zone: z.string(),
      delivery_date: z.string(),
      compare_delivery_date: z.string().nullable().optional(),
      lines: z.array(
        z.strictObject({ product_id: z.string(), quantity: decimal, unit: z.string() }),
      ),
      expect: z.string(),
    }),
  ),
});

export type Catalog = z.infer<typeof catalogSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type DeliveryPolicy = z.infer<typeof deliveryPolicySchema>;
export type Product = z.infer<typeof productSchema>;
export type SupplierOfferRecord = z.infer<typeof offerSchema>;
export type BuyerRecord = z.infer<typeof buyerSchema>;
export type SavedList = BuyerRecord["saved_lists"][number];
export type SavedListLine = SavedList["lines"][number];
