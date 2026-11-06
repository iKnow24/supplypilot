/**
 * A PO as a one-or-more page US Letter PDF, drawn with pdf-lib's built-in Helvetica
 * (no font files, no headless browser). Text outside the font's character set is replaced,
 * never dropped silently.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { formatDate, formatTime } from "../delivery";
import { formatCents } from "../money";
import type { PurchaseOrder } from "./types";

const PAGE = { width: 612, height: 792, margin: 48 };
const INK = rgb(0.12, 0.13, 0.16);
const MUTED = rgb(0.42, 0.44, 0.48);
const RULE = rgb(0.86, 0.86, 0.84);
const ACCENT = rgb(0.16, 0.42, 0.33);

/** Replace characters the standard (WinAnsi) font can't encode, e.g. emoji. */
function safeText(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let t = safeText(font, text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function purchaseOrderPdf(
  po: PurchaseOrder,
  buyerName: string,
  opts: { synthetic: boolean; dataLabel: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Purchase order ${po.number}`);
  doc.setSubject(`${po.supplier_name}, delivery ${po.delivery_date}`);
  doc.setProducer("SupplyPilot");
  doc.setCreator("SupplyPilot");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;

  const text = (
    s: string,
    x: number,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: typeof INK;
      align?: "left" | "right";
      width?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const t = opts.width ? fit(font, s, size, opts.width) : safeText(font, s);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, {
      x: opts.align === "right" ? x - w : x,
      y,
      size,
      font,
      color: opts.color ?? INK,
    });
  };
  const rule = (yy: number) =>
    page.drawLine({
      start: { x: left, y: yy },
      end: { x: right, y: yy },
      thickness: 0.75,
      color: RULE,
    });

  // Columns: line # | SKU | item | packs | pack | price | total
  const cols = {
    n: left,
    sku: left + 22,
    item: left + 102,
    packs: left + 318,
    pack: left + 330,
    price: right - 70,
    total: right,
  };

  const tableHeader = () => {
    text("#", cols.n, { size: 8, color: MUTED });
    text("SUPPLIER SKU", cols.sku, { size: 8, color: MUTED });
    text("ITEM", cols.item, { size: 8, color: MUTED });
    text("PACKS", cols.packs, { size: 8, color: MUTED, align: "right" });
    text("PACK", cols.pack, { size: 8, color: MUTED });
    text("PER PACK", cols.price, { size: 8, color: MUTED, align: "right" });
    text("TOTAL", cols.total, { size: 8, color: MUTED, align: "right" });
    rule(y - 6);
    y -= 20;
  };

  const newPage = (continued: boolean) => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - PAGE.margin;
    if (continued) {
      text(`Purchase order ${po.number} (continued)`, left, { size: 10, font: bold });
      y -= 28;
      tableHeader();
    }
  };

  // ---------------------------------------------------------------- header
  newPage(false);
  text("SupplyPilot", left, { size: 10, font: bold, color: ACCENT });
  text(po.status === "exported" ? "EXPORTED" : "DRAFT", right, {
    size: 9,
    font: bold,
    color: MUTED,
    align: "right",
  });
  y -= 30;
  text("Purchase order", left, { size: 22, font: bold });
  text(po.number, right, { size: 14, font: bold, align: "right" });
  y -= 30;

  const block = (x: number, label: string, linesOf: string[]) => {
    const top = y;
    text(label.toUpperCase(), x, { size: 8, color: MUTED });
    y -= 14;
    for (const l of linesOf) {
      text(l, x, { size: 10, width: 240 });
      y -= 13;
    }
    const used = top - y;
    y = top;
    return used;
  };
  const h1 = block(left, "Buyer / deliver to", [
    buyerName,
    po.deliver_to.location_name,
    po.deliver_to.address_label,
  ]);
  const h2 = block(left + 280, "Supplier", [po.supplier_name]);
  y -= Math.max(h1, h2) + 8;
  const h3 = block(left, "Delivery date", [formatDate(po.delivery_date, "long")]);
  const h4 = block(left + 280, "Order by", [
    `${formatDate(po.order_by_date, "long")}, ${formatTime(po.order_by_time)}`,
  ]);
  y -= Math.max(h3, h4) + 18;

  // ---------------------------------------------------------------- lines
  tableHeader();
  po.lines.forEach((l, i) => {
    if (y < PAGE.margin + 120) newPage(true);
    text(String(i + 1), cols.n, { size: 9, color: MUTED });
    text(l.supplier_sku, cols.sku, { size: 9, width: 76 });
    text(l.product_name, cols.item, { size: 9.5, width: 190 });
    text(String(l.packs), cols.packs, { size: 9.5, align: "right" });
    text(l.pack_label, cols.pack, { size: 9, color: MUTED, width: cols.price - cols.pack - 58 });
    text(formatCents(l.pack_price_cents), cols.price, { size: 9.5, align: "right" });
    text(formatCents(l.line_total_cents), cols.total, { size: 9.5, align: "right" });
    y -= 18;
  });
  rule(y + 8);
  y -= 10;

  // ---------------------------------------------------------------- totals
  const total = (label: string, cents: number, strong = false) => {
    text(label, cols.price - 40, {
      size: strong ? 11 : 10,
      font: strong ? bold : regular,
      align: "right",
    });
    text(formatCents(cents), cols.total, {
      size: strong ? 11 : 10,
      font: strong ? bold : regular,
      align: "right",
    });
    y -= strong ? 18 : 15;
  };
  total("Items subtotal", po.items_subtotal_cents);
  total(po.delivery_fee_cents ? "Delivery fee" : "Delivery fee (waived)", po.delivery_fee_cents);
  total("Total", po.total_cents, true);

  // ---------------------------------------------------------------- footer on every page
  pages.forEach((p, i) => {
    page = p;
    y = PAGE.margin - 16;
    const note = opts.synthetic
      ? `${opts.dataLabel}. Fictional supplier and buyer; not a real order.`
      : "Prices as quoted when this order was approved. Please confirm with the supplier.";
    text(note, left, { size: 8, color: MUTED, width: 420 });
    text(`Page ${i + 1} of ${pages.length}`, right, { size: 8, color: MUTED, align: "right" });
  });

  return doc.save();
}
