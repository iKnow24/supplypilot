/**
 * A PO as a spreadsheet-friendly CSV: header block, line items, totals. Money is a plain
 * decimal ("26.50") so spreadsheets treat it as a number.
 */
import { formatDate, formatTime } from "../delivery";
import type { PurchaseOrder } from "./types";

const dollars = (cents: number) => (cents / 100).toFixed(2);

function field(v: string | number): string {
  const s = String(v);
  // Quote anything with separators; neutralize leading =,+,-,@ (spreadsheet formula injection).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function purchaseOrderCsv(po: PurchaseOrder, buyerName: string): string {
  const rows: (string | number)[][] = [
    ["Purchase order", po.number],
    ["Status", po.status === "exported" ? "Exported" : "Draft"],
    ["Buyer", buyerName],
    ["Deliver to", `${po.deliver_to.location_name}, ${po.deliver_to.address_label}`],
    ["Supplier", po.supplier_name],
    ["Delivery date", formatDate(po.delivery_date, "long")],
    ["Order by", `${formatDate(po.order_by_date, "long")}, ${formatTime(po.order_by_time)}`],
    [],
    ["Line", "Supplier SKU", "Item", "Packs", "Pack", "Price per pack (USD)", "Line total (USD)"],
    ...po.lines.map((l, i) => [
      i + 1,
      l.supplier_sku,
      l.product_name,
      l.packs,
      l.pack_label,
      dollars(l.pack_price_cents),
      dollars(l.line_total_cents),
    ]),
    [],
    ["", "", "", "", "", "Items subtotal", dollars(po.items_subtotal_cents)],
    ["", "", "", "", "", "Delivery fee", dollars(po.delivery_fee_cents)],
    ["", "", "", "", "", "Total", dollars(po.total_cents)],
  ];
  return rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

export function purchaseOrderFilename(po: PurchaseOrder, ext: "csv" | "pdf"): string {
  const supplier = po.supplier_name
    .replace(/\(Demo\)/, "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${po.number}-${supplier}.${ext}`;
}
