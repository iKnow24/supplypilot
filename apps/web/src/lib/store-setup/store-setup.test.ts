// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { READINGS } from "../../../e2e/fixtures/setup/documents.mjs";
import { CatalogIndex } from "../cart/validation";
import { SeedCatalogRepository } from "../catalog/seed-repository";
import type { SetupExtraction } from "./extraction-schema";
import { sniffSetupFile } from "./files";
import { normalizeDocument, normalizeSetupLine } from "./normalize";
import {
  buildReview,
  removeLine,
  reviewContext,
  setItemProduct,
  toPayload,
  updateDoc,
  updateItem,
  type Review,
} from "./review";
import { cellNumber, parseCsv, rowHasNumber, sheetText } from "./sheet";
import type { DocumentDraft, SetupPayload } from "./types";
import { estimateWeekly, mondayOf, weeksCovered } from "./usage";
import { validateSetup } from "./validate";
import { readXlsx } from "./xlsx";

const repo = SeedCatalogRepository.fromSeed();
const products = await repo.listProducts();
const units = await repo.units();
const suppliers = await repo.listSuppliers();
const index = new CatalogIndex(products, units);
const ctx = reviewContext(products, units);
const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name;

const FIXTURES = path.resolve(import.meta.dirname, "../../../e2e/fixtures/setup");
const csvRows = parseCsv(readFileSync(path.join(FIXTURES, "inventory-count.csv"), "utf8"));
const readings = READINGS as Record<string, SetupExtraction>;

function draftsFromFixtures(): DocumentDraft[] {
  return Object.entries(readings).map(([fileName, raw], i) =>
    normalizeDocument(raw, {
      key: `d${i + 1}`,
      fileName,
      index,
      products,
      suppliers,
      sheetRows: fileName.endsWith(".csv") ? csvRows : null,
    }),
  );
}

const item = (r: Review, productId: string) => r.items.find((i) => i.productId === productId)!;
const named = (r: Review, name: RegExp) => r.items.find((i) => name.test(i.name))!;

describe("spreadsheets", () => {
  it("parses CSV with quotes, a BOM, CRLF and other delimiters", () => {
    expect(parseCsv('﻿Item,Count\r\n"Flour, AP ""unbl""",3\r\n\r\nEggs,5,,\n')).toEqual([
      ["Item", "Count"],
      ['Flour, AP "unbl"', "3"],
      ["Eggs", "5"],
    ]);
    expect(parseCsv("Item;Count\nSugar;1,5")).toEqual([
      ["Item", "Count"],
      ["Sugar", "1,5"],
    ]);
    expect(parseCsv("Item\tCount\nMilk\t3")).toEqual([
      ["Item", "Count"],
      ["Milk", "3"],
    ]);
  });

  it("numbers rows for the AI and checks counts against the cells", () => {
    expect(
      sheetText([
        ["Item", "Count"],
        ["Milk", "3"],
      ]),
    ).toBe("Row 1: Item | Count\nRow 2: Milk | 3");
    expect(cellNumber("1,200")).toBe(1200);
    expect(cellNumber("2.5")).toBe(2.5);
    expect(cellNumber("12 lb")).toBe(12);
    expect(cellNumber("Milk")).toBeNull();
    expect(rowHasNumber(["Milk", "3", "gal"], "3")).toBe(true);
    expect(rowHasNumber(["Milk", "3", "gal"], "30")).toBe(false);
    expect(rowHasNumber(undefined, "3")).toBe(false);
  });

  /** A minimal .xlsx: a zip of the XML parts Excel writes (one part deflated, like Excel). */
  function xlsx(): Uint8Array {
    const parts: [string, string, boolean][] = [
      [
        "xl/workbook.xml",
        '<workbook xmlns:r="r"><sheets><sheet name="Count" sheetId="1" r:id="rId7"/></sheets></workbook>',
        false,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/count.xml"/></Relationships>',
        false,
      ],
      [
        "xl/sharedStrings.xml",
        "<sst><si><t>Item</t></si><si><t>Count</t></si><si><r><t>Flour &amp; </t></r><r><t>sugar</t></r></si></sst>",
        false,
      ],
      [
        "xl/worksheets/count.xml",
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>0.30000000000000004</v></c></row>' +
          '<row r="3"><c r="A3" t="inlineStr"><is><t>Eggs</t></is></c><c r="B3"><f>2+3</f><v>5</v></c></row>' +
          "</sheetData></worksheet>",
        true,
      ],
    ];
    const local: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const [name, xml, deflate] of parts) {
      const raw = Buffer.from(xml);
      const data = deflate ? deflateRawSync(raw) : raw;
      const n = Buffer.from(name);
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(deflate ? 8 : 0, 8);
      lh.writeUInt32LE(data.length, 18);
      lh.writeUInt32LE(raw.length, 22);
      lh.writeUInt16LE(n.length, 26);
      local.push(lh, n, data);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0);
      ch.writeUInt16LE(deflate ? 8 : 0, 10);
      ch.writeUInt32LE(data.length, 20);
      ch.writeUInt32LE(raw.length, 24);
      ch.writeUInt16LE(n.length, 28);
      ch.writeUInt32LE(offset, 42);
      central.push(ch, n);
      offset += 30 + n.length + data.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(parts.length, 8);
    end.writeUInt16LE(parts.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...local, cd, end]));
  }

  it("reads the first sheet of an .xlsx file with no library", () => {
    const r = readXlsx(xlsx());
    expect(r).toEqual({
      ok: true,
      value: [
        ["Item", "Count"],
        ["Flour & sugar", "", "0.3"],
        ["Eggs", "5"],
      ],
    });
    expect(sniffSetupFile(xlsx(), "count.xlsx")).toEqual({ kind: "xlsx" });
  });

  it("refuses files that aren't what they claim", () => {
    expect(readXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])).ok).toBe(false);
    expect(sniffSetupFile(xlsx(), "count.zip")).toBeNull();
    expect(sniffSetupFile(new TextEncoder().encode("%PDF-1.7 ..."), "x.csv")).toEqual({
      kind: "pdf",
    });
    expect(sniffSetupFile(new TextEncoder().encode("a,b\n1,2"), "count.csv")).toEqual({
      kind: "csv",
    });
    expect(sniffSetupFile(new Uint8Array([0, 1, 2, 3]), "count.csv")).toBeNull();
    expect(sniffSetupFile(new TextEncoder().encode("a,b"), "count.xls")).toBeNull();
    const png = readFileSync(path.join(FIXTURES, "lake-ivanhoe-farms-text.png"));
    expect(sniffSetupFile(png, "anything.pdf")).toEqual({ kind: "image", mediaType: "image/png" });
  });
});

describe("cleaning up what the AI read", () => {
  const base = {
    description: "x",
    product_id: "prd_flour_ap_unbl",
    pack_quantity: "50",
    pack_unit: "lb",
    pack_label: "50 lb bag",
    price: "26.50",
    price_per: "pack" as const,
    packs_bought: "6",
    line_total: "159.00",
    on_hand: null,
    on_hand_per: null,
    on_hand_unit: null,
    sheet_row: null,
    confidence: "high" as const,
  };
  const opts = { index, products, sheetRows: csvRows };

  it("turns a count in packs into units, and checks it against the sheet's row", () => {
    const counted = { ...base, price: null, line_total: null, packs_bought: null };
    const ok = normalizeSetupLine(
      { ...counted, on_hand: "3", on_hand_per: "pack", sheet_row: 2 },
      "k",
      "inventory",
      opts,
    );
    expect(ok).toMatchObject({ count: "150", countUnit: "lb", countReadAs: "3 × 50 lb bag" });
    expect(ok.issues).toEqual([]);

    // The AI said 30, but row 2 says 3: flagged, never trusted.
    const off = normalizeSetupLine(
      { ...counted, on_hand: "30", on_hand_per: "pack", sheet_row: 2 },
      "k",
      "inventory",
      opts,
    );
    expect(off.issues).toContain("Check the count: row 2 of the sheet doesn't show it");
    expect(off.confidence).toBe("low");

    const noPack = normalizeSetupLine(
      { ...counted, pack_quantity: null, on_hand: "3", on_hand_per: "pack", sheet_row: 2 },
      "k",
      "inventory",
      opts,
    );
    expect(noPack.count).toBe("");
    expect(noPack.issues).toContain("Check the count: how much is in one pack?");

    const wrongUnit = normalizeSetupLine(
      { ...counted, on_hand: "3", on_hand_per: "unit", on_hand_unit: "gal", sheet_row: 2 },
      "k",
      "inventory",
      opts,
    );
    expect(wrongUnit.issues).toContain("All-purpose flour, unbleached can't be counted in gal");
  });

  it("checks invoice arithmetic, and prices a pack from the line total when that's all there is", () => {
    const ok = normalizeSetupLine(base, "k", "invoice", opts);
    expect(ok).toMatchObject({ priceCents: 2650, packs: "6", issues: [] });

    const fromTotal = normalizeSetupLine({ ...base, price: null }, "k", "invoice", opts);
    expect(fromTotal).toMatchObject({ priceCents: 2650, readAs: "$159.00 line total ÷ 6" });
    expect(fromTotal.issues).toEqual([]);

    const mismatch = normalizeSetupLine({ ...base, line_total: "165.00" }, "k", "invoice", opts);
    expect(mismatch.issues).toContain("The line total ($165.00) isn't 6 × $26.50");

    const noQty = normalizeSetupLine({ ...base, packs_bought: null }, "k", "invoice", opts);
    expect(noQty.issues).toContain("Check how many were bought");
  });

  it("reads the fixture documents with no issues except the ones we expect", () => {
    const drafts = draftsFromFixtures();
    const issues = drafts.flatMap((d) =>
      d.lines.filter((l) => l.issues.length).map((l) => `${l.description}: ${l.issues}`),
    );
    expect(issues).toEqual([
      "Kosher salt (3 lb box): Pick the matching product",
      "Lavender buds: Pick the matching product",
      "Culinary Lavender Buds 4 oz: Pick the matching product",
    ]);
    const meadowlark = drafts.find((d) => d.fileName.startsWith("meadowlark"))!;
    expect(meadowlark).toMatchObject({
      kind: "invoice",
      supplierId: "sup_meadowlark",
      documentDate: "2026-11-02",
    });
    const text = drafts.find((d) => d.kind === "text_message")!;
    expect(text).toMatchObject({ vendorName: "Lake Ivanhoe Farms", supplierId: null });
  });
});

describe("weekly use from invoices", () => {
  it("counts the weeks invoices cover, first to last", () => {
    expect(weeksCovered(["2026-10-27", "2026-11-03"])).toBe(2);
    expect(weeksCovered(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"])).toBe(4);
    expect(weeksCovered(["2026-11-02"])).toBe(1);
    expect(mondayOf("2026-11-05")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
  });

  it("adds up what was bought and divides by those weeks; rates from several vendors add", () => {
    const dates = new Map([
      ["a", ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]],
      ["b", ["2026-11-02"]],
    ]);
    // Bought every other week from vendor a: 30 + 30 over 4 weeks.
    const e = estimateWeekly(
      [
        { vendorKey: "a", date: "2026-10-12", quantity: 30 },
        { vendorKey: "a", date: "2026-10-26", quantity: 30 },
      ],
      dates,
      "dozen",
    )!;
    expect(e.weekly).toBe(15);
    expect(e.basis).toBe("60 dozen on 2 invoices over 4 weeks");
    expect(e.caution).toBeNull();

    const both = estimateWeekly(
      [
        { vendorKey: "a", date: "2026-10-12", quantity: 40 },
        { vendorKey: "b", date: "2026-11-02", quantity: 5 },
      ],
      dates,
      "lb",
    )!;
    expect(both.weekly).toBe(15);
    expect(estimateWeekly([], dates, "lb")).toBeNull();
  });
});

describe("the review", () => {
  const fresh = () => buildReview(draftsFromFixtures(), ctx);

  it("merges every document into one list of the store's items", () => {
    const r = fresh();
    const matched = r.items.filter((i) => i.productId);
    expect(matched).toHaveLength(11);
    // Named the way the store's own count names them.
    expect(item(r, "prd_flour_ap_unbl").name).toBe("AP flour unbleached (50 lb bags)");
    // Unmatched items come last; the lavender on the count and on the invoice stay apart
    // because they're worded differently, and both are kept.
    expect(r.items.filter((i) => !i.productId).map((i) => i.name)).toEqual([
      "Kosher salt (3 lb box)",
      "Lavender buds",
      "Culinary Lavender Buds 4 oz",
    ]);
    expect(r.counted).toEqual(["inventory-count.csv"]);
    expect(r.docs).toHaveLength(4);
  });

  it("works out on hand, weekly use and a usual order with plain arithmetic", () => {
    const r = fresh();
    expect(item(r, "prd_flour_ap_unbl")).toMatchObject({
      unit: "lb",
      onHand: "150", // 3 × 50 lb bags
      weekly: "300", // 12 bags × 50 lb over 2 weeks of Bramblewood invoices
      usual: "300",
      weeklyBasis: "600 lb on 2 invoices over 2 weeks",
      weeklyCaution: null,
    });
    expect(item(r, "prd_choc_chips")).toMatchObject({ onHand: "12.5", weekly: "25" });
    expect(item(r, "prd_box_pastry_10")).toMatchObject({ onHand: "120", weekly: "200" });
    // Vanilla was bought once in two weeks.
    expect(item(r, "prd_vanilla")).toMatchObject({ onHand: "24", weekly: "16", unit: "fl_oz" });
    // One Meadowlark invoice: the estimate assumes a weekly order, and says so.
    expect(item(r, "prd_eggs_large")).toMatchObject({
      onHand: "5",
      weekly: "30",
      usual: "30",
      weeklyCaution: "From one week of invoices, so this assumes you order it every week",
    });
    // The farm's text is a quote, not a purchase: it doesn't change weekly use.
    expect(r.docs.find((d) => d.kind === "text_message")!.lines[0]!.itemKey).toBe(
      item(r, "prd_eggs_large").key,
    );
  });

  it("re-derives weekly use when the buyer fixes an invoice, unless they typed their own", () => {
    let r = fresh();
    const doc = r.docs.find((d) => d.fileName === "bramblewood-invoice-oct-27.pdf")!;
    r = updateDoc(r, doc.key, { documentDate: "" }, ctx);
    // Undated invoice: it can't be placed in time, so only Nov 3's 6 bags over 1 week count.
    expect(item(r, "prd_flour_ap_unbl").weekly).toBe("300");
    expect(item(r, "prd_vanilla").weekly).toBe("");

    r = updateItem(r, item(r, "prd_vanilla").key, { weekly: "10" }, ctx);
    r = updateDoc(r, doc.key, { documentDate: "2026-10-27" }, ctx);
    expect(item(r, "prd_vanilla")).toMatchObject({ weekly: "10", usual: "10", weeklyEdited: true });
  });

  it("matching an item converts its numbers, and matching onto another item merges them", () => {
    let r = fresh();
    const salt = named(r, /Kosher salt/);
    expect(salt).toMatchObject({ productId: "", unit: "lb", onHand: "6" });
    r = setItemProduct(r, salt.key, "prd_salt_kosher", ctx);
    expect(item(r, "prd_salt_kosher")).toMatchObject({ unit: "lb", onHand: "6" });

    // The invoice's lavender is really the counted lavender... say the buyer matches both to
    // honey (made up): the second one merges into the first, and counts add up.
    r = setItemProduct(r, named(r, /^Lavender buds$/).key, "prd_honey", ctx);
    expect(item(r, "prd_honey")).toMatchObject({ unit: "lb", onHand: "0.188" });
    r = setItemProduct(r, named(r, /Culinary Lavender/).key, "prd_honey", ctx);
    expect(r.items.filter((i) => i.productId === "prd_honey")).toHaveLength(1);
    const line = r.docs.flatMap((d) => d.lines).find((l) => /Culinary/.test(l.description))!;
    expect(line.itemKey).toBe(item(r, "prd_honey").key);
    // Bought once on the Nov 3 invoice: 4 oz over 2 weeks.
    expect(item(r, "prd_honey").weekly).toBe("0.1");
  });

  it("drops a line, and an item nothing else mentions", () => {
    let r = fresh();
    const doc = r.docs.find((d) => d.fileName === "bramblewood-invoice-nov-3.png")!;
    const lavender = doc.lines.find((l) => /Lavender/.test(l.description))!;
    r = removeLine(r, doc.key, lavender.key, ctx);
    expect(r.items.some((i) => /Culinary Lavender/.test(i.name))).toBe(false);
    expect(named(r, /^Lavender buds$/)).toBeDefined(); // still on the count
  });
});

describe("saving: the server's checks", () => {
  const today = "2026-11-10";
  const check = (p: unknown) =>
    validateSetup(p, {
      index,
      suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
      today,
    });
  const payload = (): SetupPayload => {
    let r = buildReview(draftsFromFixtures(), ctx);
    r = setItemProduct(r, named(r, /Kosher salt/).key, "prd_salt_kosher", ctx);
    r = updateItem(r, item(r, "prd_salt_kosher").key, { weekly: "3" }, ctx);
    return toPayload(r, supplierName);
  };

  it("builds counts, a usage history, the usual order and dated vendor prices", () => {
    const r = check(payload());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value;

    expect(s.items).toHaveLength(14);
    expect(s.items.filter((i) => !i.product_id)).toEqual([
      {
        name: "Lavender buds",
        product_id: null,
        vendor_name: null,
        note: "Counted 3 oz.",
      },
      {
        name: "Culinary Lavender Buds 4 oz",
        product_id: null,
        vendor_name: "Bramblewood Baking Supply (Demo)",
        note: "Bought 1 × 4 oz bag at $16.25 from Bramblewood Baking Supply on Tue, Nov 3.",
      },
    ]);

    expect(s.counts).toContainEqual({
      product_id: "prd_flour_ap_unbl",
      quantity: "150",
      unit: "lb",
    });
    expect(s.counts).toContainEqual({ product_id: "prd_salt_kosher", quantity: "6", unit: "lb" });
    expect(s.counts).toHaveLength(12);

    // Two weeks of Bramblewood invoices: two Mondays, ending the week of the latest invoice.
    const flour = s.usage.filter((u) => u.product_id === "prd_flour_ap_unbl");
    expect(flour).toEqual([
      { product_id: "prd_flour_ap_unbl", week_start: "2026-10-26", quantity: "300", unit: "lb" },
      { product_id: "prd_flour_ap_unbl", week_start: "2026-11-02", quantity: "300", unit: "lb" },
    ]);
    expect(s.usage.filter((u) => u.product_id === "prd_eggs_large")).toHaveLength(1);
    // Typed by the buyer, no invoices: four weeks of their number.
    expect(s.usage.filter((u) => u.product_id === "prd_salt_kosher")).toHaveLength(4);
    expect(s.usage.every((u) => new Date(`${u.week_start}T12:00:00Z`).getUTCDay() === 1)).toBe(
      true,
    );

    expect(s.usual_list!.name).toBe("Usual order");
    expect(s.usual_list!.lines).toContainEqual({
      product_id: "prd_eggs_large",
      quantity: "30",
      unit: "dozen",
      current_supplier_id: "sup_meadowlark", // bought there; the farm only quoted
    });
    expect(s.usual_list!.lines).toContainEqual({
      product_id: "prd_salt_kosher",
      quantity: "3",
      unit: "lb",
      current_supplier_id: null,
    });

    expect(
      s.imports.map((i) => [i.vendor_name, i.document_kind, i.document_date, i.lines.length]),
    ).toEqual([
      ["Bramblewood Baking Supply (Demo)", "invoice", "2026-10-27", 7],
      ["Bramblewood Baking Supply (Demo)", "invoice", "2026-11-03", 6], // lavender kept as a note
      ["Meadowlark Dairy Co-op (Demo)", "invoice", "2026-11-02", 4],
      ["Lake Ivanhoe Farms", "text_message", "2026-11-06", 1],
    ]);
    expect(s.imports[0]!.lines[0]).toEqual({
      product_id: "prd_flour_ap_unbl",
      description: "AP Flour Unbleached 50#",
      pack_quantity: "50",
      pack_unit: "lb",
      pack_label: "50 lb bag",
      price_cents: 2650,
      confidence: "high",
      mapping_method: "ai_suggested",
      packs: "6",
    });
    expect(s.imports[3]!.lines[0]!.packs).toBeNull();
  });

  it("refuses anything wrong, with a message that says where", () => {
    const p = payload();
    const firstMatched = p.items.findIndex((i) => i.productId);
    const withItem = (patch: Partial<SetupPayload["items"][number]>, at = firstMatched) => ({
      ...p,
      items: p.items.map((it, i) => (i === at ? { ...it, ...patch } : it)),
    });
    const withDoc = (patch: Partial<SetupPayload["documents"][number]>) => ({
      ...p,
      documents: p.documents.map((d, i) => (i === 0 ? { ...d, ...patch } : d)),
    });
    const withLine = (patch: Partial<SetupPayload["documents"][number]["lines"][number]>) =>
      withDoc({ lines: p.documents[0]!.lines.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) });

    const cases: [unknown, RegExp][] = [
      [null, /couldn't be read/],
      [withItem({ productId: "prd_nope" }), /Pick the matching product/],
      [withItem({ onHand: "lots" }), /On hand: use a number/],
      [withItem({ weekly: "-2" }), /Weekly use: use a number/],
      [
        withItem(
          { usual: "2.5", unit: "each" },
          p.items.findIndex((i) => i.productId === "prd_box_pastry_10"),
        ),
        /whole/,
      ],
      [withItem({ unit: "gal" }), /Pick a unit/],
      [withItem({ productId: "prd_flour_bread" }), /listed twice/],
      [{ ...p, items: p.items.map((i) => ({ ...i, productId: null })) }, /Match at least one item/],
      [
        withDoc({ supplierId: null, vendorName: " " }),
        /bramblewood-invoice-oct-27.pdf: name the vendor/,
      ],
      [withDoc({ supplierId: "sup_nope" }), /unknown supplier/],
      [withDoc({ documentDate: "2026-12-25" }), /future/],
      [withDoc({ documentDate: "2023-01-01" }), /two years/],
      [withDoc({ kind: "inventory" }), /what kind of document/],
      [withLine({ price: "free" }), /line 1 .*: Enter the pack price/],
      [withLine({ packUnit: "gal" }), /line 1 .*: Pack: .*can't be measured/],
      [withLine({ packs: "many" }), /Packs bought/],
      [withLine({ itemKey: "p:prd_ghost" }), /couldn't be read/],
      [{ ...p, items: Array.from({ length: 301 }, () => p.items[0]) }, /couldn't be read/],
    ];
    for (const [input, error] of cases) {
      const r = check(input);
      expect(r.ok, JSON.stringify(input).slice(0, 120)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(error);
    }
  });

  it("records whether the buyer kept the AI's match", () => {
    const r = check(payload());
    if (!r.ok) throw new Error(r.error);
    const methods = r.value.imports.flatMap((i) => i.lines.map((l) => l.mapping_method));
    expect(new Set(methods)).toEqual(new Set(["ai_suggested"]));
  });
});
