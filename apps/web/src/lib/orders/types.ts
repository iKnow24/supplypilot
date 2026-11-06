/** Purchase orders: snapshots of an approved result, one per supplier. */

export type PoStatus = "draft" | "exported";

export interface DeliverTo {
  buyer_name: string;
  location_name: string;
  address_label: string;
  zone: string;
}

export interface PurchaseOrderLineDraft {
  product_id: string;
  product_name: string;
  /** The product the buyer asked for (differs for an approved equivalent). */
  requested_product_id: string;
  offer_id: string;
  supplier_sku: string;
  packs: number;
  pack_label: string;
  pack_quantity: string;
  pack_unit: string;
  pack_price_cents: number;
  price_basis: "contract" | "list" | "volume_tier";
  line_total_cents: number;
}

export interface PurchaseOrderDraft {
  supplier_id: string;
  supplier_name: string;
  delivery_date: string;
  order_by_date: string;
  order_by_time: string;
  deliver_to: DeliverTo;
  items_subtotal_cents: number;
  delivery_fee_cents: number;
  lines: PurchaseOrderLineDraft[];
}

export interface PurchaseOrder extends PurchaseOrderDraft {
  id: string;
  runId: string;
  number: string;
  status: PoStatus;
  total_cents: number;
  createdAt: Date;
  exportedAt: Date | null;
}

export type PurchaseOrderSummary = Omit<PurchaseOrder, "lines" | "deliver_to"> & {
  lineCount: number;
};
