/**
 * A brand-new (fictional) bakery's own documents, for "Set up from your documents":
 * an inventory count (CSV), three supplier invoices (two PDFs, one photo) and a text from a
 * local farm. render.mjs turns these into the files in this folder; the mock AI
 * (e2e/mock-anthropic.mjs) answers with READINGS, the transcription a careful reader would give.
 * Everything here is invented demo data.
 */

const BAKERY = "Orange Blossom Bakehouse";

/** A line as printed on an invoice. */
const l = (sku, description, qty, uom, price, read) => ({
  sku,
  description,
  qty,
  uom,
  price,
  read,
});

export const INVOICES = [
  {
    file: "bramblewood-invoice-oct-27.pdf",
    vendor: "Bramblewood Baking Supply",
    address: "2200 Mercy Dr, Orlando FL (fictional)",
    number: "BW-20417",
    date: "2026-10-27",
    printedDate: "10/27/2026",
    lines: [
      l("BW-1101", "AP Flour Unbleached 50#", 6, "BAG", "26.50", [
        "prd_flour_ap_unbl",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-1140", "Bread Flour Hi-Gluten 50#", 2, "BAG", "24.75", [
        "prd_flour_bread",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-2010", "Cane Sugar Granulated 50#", 2, "BAG", "38.90", [
        "prd_sugar_gran_cane",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-3302", "Instant Dry Yeast 1#", 2, "EA", "6.40", [
        "prd_yeast_instant",
        "1",
        "lb",
        "1 lb brick",
      ]),
      l("BW-4410", "Semi-Sweet Choc Chips 25#", 1, "CS", "89.00", [
        "prd_choc_chips",
        "25",
        "lb",
        "25 lb case",
      ]),
      l("BW-4602", "Pure Vanilla Extract 32 oz", 1, "EA", "78.00", [
        "prd_vanilla",
        "32",
        "fl_oz",
        "32 fl oz bottle",
      ]),
      l("BW-7110", "Pastry Box 10x10x5 (100/cs)", 2, "CS", "41.00", [
        "prd_box_pastry_10",
        "100",
        "each",
        "case of 100",
      ]),
    ],
  },
  {
    file: "bramblewood-invoice-nov-3.png",
    vendor: "Bramblewood Baking Supply",
    address: "2200 Mercy Dr, Orlando FL (fictional)",
    number: "BW-20588",
    date: "2026-11-03",
    printedDate: "11/03/2026",
    lines: [
      l("BW-1101", "AP Flour Unbleached 50#", 6, "BAG", "26.50", [
        "prd_flour_ap_unbl",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-1140", "Bread Flour Hi-Gluten 50#", 2, "BAG", "24.75", [
        "prd_flour_bread",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-2010", "Cane Sugar Granulated 50#", 2, "BAG", "38.90", [
        "prd_sugar_gran_cane",
        "50",
        "lb",
        "50 lb bag",
      ]),
      l("BW-3302", "Instant Dry Yeast 1#", 2, "EA", "6.40", [
        "prd_yeast_instant",
        "1",
        "lb",
        "1 lb brick",
      ]),
      l("BW-4410", "Semi-Sweet Choc Chips 25#", 1, "CS", "89.00", [
        "prd_choc_chips",
        "25",
        "lb",
        "25 lb case",
      ]),
      l("BW-7110", "Pastry Box 10x10x5 (100/cs)", 2, "CS", "41.00", [
        "prd_box_pastry_10",
        "100",
        "each",
        "case of 100",
      ]),
      l("BW-9050", "Culinary Lavender Buds 4 oz", 1, "EA", "16.25", [null, "4", "oz", "4 oz bag"]),
    ],
  },
  {
    file: "meadowlark-invoice-nov-2.pdf",
    vendor: "Meadowlark Dairy Co-op",
    address: "Route 9 Creamery Rd, Sanford FL (fictional)",
    number: "ML-88123",
    date: "2026-11-02",
    printedDate: "11/02/2026",
    lines: [
      l("D-110", "Butter Unsalted AA 36/1#", 1, "CS", "142.20", [
        "prd_butter_unsalted",
        "36",
        "lb",
        "case of 36 × 1 lb",
      ]),
      l("E-015", "Eggs Large Grade A 15 dz", 2, "CS", "49.50", [
        "prd_eggs_large",
        "15",
        "dozen",
        "case of 15 dozen",
      ]),
      l("M-401", "Whole Milk 4/1 gal", 2, "CS", "17.20", [
        "prd_milk_whole",
        "4",
        "gal",
        "case of 4 × 1 gal",
      ]),
      l("C-312", "Heavy Cream 36% 12/1 qt", 1, "CS", "46.80", [
        "prd_cream_heavy",
        "12",
        "qt",
        "case of 12 qt",
      ]),
    ],
  },
];

export const TEXT = {
  file: "lake-ivanhoe-farms-text.png",
  from: "Maria · Lake Ivanhoe Farms",
  when: "Fri, Nov 6, 7:40 AM",
  date: "2026-11-06",
  messages: [
    "Morning! Fresh eggs this week for Orange Blossom:",
    "Large brown eggs $47.25 per 15 doz case. Can drop Tues + Fri.",
  ],
};

export const INVENTORY_FILE = "inventory-count.csv";

const money = (s) => Number(s).toFixed(2);
const cents = (s) => Math.round(Number(s) * 100);

export function invoiceTotal(inv) {
  return inv.lines.reduce((sum, x) => sum + x.qty * cents(x.price), 0);
}

/** The invoice as a printable page (rendered to a PDF or a photo-like PNG). */
export function invoiceHtml(inv, { photo = false } = {}) {
  const rows = inv.lines
    .map(
      (
        x,
      ) => `<tr><td>${x.sku}</td><td>${x.description}</td><td class="n">${x.qty}</td><td>${x.uom}</td>
        <td class="n">${money(x.price)}</td><td class="n">${money((x.qty * cents(x.price)) / 100)}</td></tr>`,
    )
    .join("");
  const total = money(invoiceTotal(inv) / 100);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:13px "Helvetica Neue",Arial,sans-serif;color:#1a1a1a;background:${photo ? "#d9d4c7" : "#fff"}}
    .sheet{background:#fff;width:720px;margin:${photo ? "28px auto" : "0"};padding:36px 40px;box-sizing:border-box;
      ${photo ? "transform:rotate(-0.8deg);box-shadow:0 10px 30px rgba(0,0,0,.25)" : ""}}
    .head{display:flex;justify-content:space-between;border-bottom:2px solid #1a1a1a;padding-bottom:14px}
    h1{font-size:22px;margin:0 0 4px} .muted{color:#555;font-size:12px}
    .inv{text-align:right} .inv b{font-size:18px;letter-spacing:.08em}
    .meta{display:flex;gap:48px;margin:18px 0}
    table{width:100%;border-collapse:collapse;margin-top:8px} th{text-align:left;font-size:11px;text-transform:uppercase;
      color:#555;border-bottom:1px solid #999;padding:6px 4px} td{padding:7px 4px;border-bottom:1px solid #e3e3e3}
    .n{text-align:right;font-variant-numeric:tabular-nums} .tot{margin-top:14px;text-align:right;font-size:15px}
    .foot{margin-top:26px;color:#777;font-size:11px}
  </style></head><body><div class="sheet">
    <div class="head"><div><h1>${inv.vendor}</h1><div class="muted">${inv.address}</div></div>
      <div class="inv"><b>INVOICE</b><div class="muted">No. ${inv.number}</div><div class="muted">Date ${inv.printedDate}</div></div></div>
    <div class="meta"><div><div class="muted">Bill to</div>${BAKERY}<br>Thornton Park shop</div>
      <div><div class="muted">Terms</div>Net 15</div><div><div class="muted">Delivered</div>${inv.printedDate}</div></div>
    <table><thead><tr><th>Item</th><th>Description</th><th class="n">Qty</th><th>U/M</th><th class="n">Price</th><th class="n">Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="tot">Delivery: 0.00<br><b>Total due: $${total}</b></div>
    <div class="foot">Fictional demo document for SupplyPilot. Not a real business.</div>
  </div></body></html>`;
}

export function textHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:390px;font:15px -apple-system,"Helvetica Neue",Arial,sans-serif;background:#fff;color:#111}
    .top{padding:14px 16px 10px;text-align:center;border-bottom:1px solid #e5e5ea;background:#f7f7f8}
    .who{font-weight:600}.sub{color:#8e8e93;font-size:12px;margin-top:2px}
    .day{color:#8e8e93;font-size:12px;text-align:center;margin:14px 0 8px}
    .msg{background:#e9e9eb;border-radius:18px;padding:9px 13px;margin:6px 60px 6px 12px;line-height:1.35}
    .foot{color:#aaa;font-size:10px;text-align:center;margin:18px 0 10px}
  </style></head><body>
    <div class="top"><div class="who">${TEXT.from}</div><div class="sub">Text Message</div></div>
    <div class="day">${TEXT.when}</div>
    ${TEXT.messages.map((m) => `<div class="msg">${m}</div>`).join("")}
    <div class="foot">Fictional demo screenshot</div>
  </body></html>`;
}

// --- What a careful reader transcribes (the mock AI's answers) -------------------------------

const invoiceReading = (inv) => ({
  document_kind: "invoice",
  is_relevant: true,
  vendor_name: inv.vendor,
  document_date: inv.date,
  notes: null,
  lines: inv.lines.map((x) => ({
    description: x.description,
    product_id: x.read[0],
    pack_quantity: x.read[1],
    pack_unit: x.read[2],
    pack_label: x.read[3],
    price: x.price,
    price_per: "pack",
    packs_bought: String(x.qty),
    line_total: money((x.qty * cents(x.price)) / 100),
    on_hand: null,
    on_hand_per: null,
    on_hand_unit: null,
    sheet_row: null,
    confidence: x.read[0] ? "high" : "medium",
  })),
});

const count = (row, description, product_id, on_hand, per, unit, pack) => ({
  description,
  product_id,
  pack_quantity: pack?.[0] ?? null,
  pack_unit: pack?.[1] ?? null,
  pack_label: pack?.[2] ?? null,
  price: null,
  price_per: "pack",
  packs_bought: null,
  line_total: null,
  on_hand,
  on_hand_per: per,
  on_hand_unit: unit,
  sheet_row: row,
  confidence: product_id ? "high" : "low",
});

export const READINGS = {
  [INVENTORY_FILE]: {
    document_kind: "inventory",
    is_relevant: true,
    vendor_name: null,
    document_date: null,
    notes: null,
    lines: [
      count(2, "AP flour unbleached (50 lb bags)", "prd_flour_ap_unbl", "3", "pack", null, [
        "50",
        "lb",
        "50 lb bag",
      ]),
      count(3, "Bread flour (50 lb bags)", "prd_flour_bread", "1", "pack", null, [
        "50",
        "lb",
        "50 lb bag",
      ]),
      count(4, "Granulated sugar (50 lb bags)", "prd_sugar_gran_cane", "1.5", "pack", null, [
        "50",
        "lb",
        "50 lb bag",
      ]),
      count(5, "Unsalted butter", "prd_butter_unsalted", "20", "unit", "lb"),
      count(6, "Large eggs", "prd_eggs_large", "5", "unit", "dozen"),
      count(7, "Whole milk", "prd_milk_whole", "3", "unit", "gal"),
      count(8, "Heavy cream", "prd_cream_heavy", "5", "unit", "qt"),
      count(9, "Instant yeast", "prd_yeast_instant", "1.5", "unit", "lb"),
      count(10, "Chocolate chips (25 lb case)", "prd_choc_chips", "0.5", "pack", null, [
        "25",
        "lb",
        "25 lb case",
      ]),
      count(11, "Vanilla extract", "prd_vanilla", "24", "unit", "fl_oz"),
      count(12, "Pastry boxes 10x10", "prd_box_pastry_10", "120", "unit", "each"),
      // Not sure which salt: left for the buyer to match.
      count(13, "Kosher salt (3 lb box)", null, "2", "pack", null, ["3", "lb", "3 lb box"]),
      count(14, "Lavender buds", null, "3", "unit", "oz"),
    ],
  },
  ...Object.fromEntries(INVOICES.map((inv) => [inv.file, invoiceReading(inv)])),
  [TEXT.file]: {
    document_kind: "text_message",
    is_relevant: true,
    vendor_name: "Lake Ivanhoe Farms",
    document_date: TEXT.date,
    notes: null,
    lines: [
      {
        description: "Large brown eggs $47.25 per 15 doz case",
        product_id: "prd_eggs_large",
        pack_quantity: "15",
        pack_unit: "dozen",
        pack_label: "case of 15 dozen",
        price: "47.25",
        price_per: "pack",
        packs_bought: null,
        line_total: null,
        on_hand: null,
        on_hand_per: null,
        on_hand_unit: null,
        sheet_row: null,
        confidence: "high",
      },
    ],
  },
};
