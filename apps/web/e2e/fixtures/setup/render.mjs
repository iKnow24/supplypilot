// Renders the fictional bakery's setup documents (documents.mjs) into the files beside it:
// invoices as PDFs or a photo-like PNG, and a text-message screenshot.
//   node e2e/fixtures/setup/render.mjs
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { INVOICES, TEXT, invoiceHtml, textHtml } from "./documents.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();

for (const inv of INVOICES) {
  const photo = inv.file.endsWith(".png");
  const page = await browser.newPage({
    viewport: { width: photo ? 780 : 720, height: 600 },
    deviceScaleFactor: photo ? 1.5 : 1,
  });
  await page.setContent(invoiceHtml(inv, { photo }));
  if (photo) {
    await page.screenshot({ path: path.join(here, inv.file), fullPage: true });
  } else {
    await page.pdf({ path: path.join(here, inv.file), format: "Letter", printBackground: true });
  }
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 390, height: 100 }, deviceScaleFactor: 2 });
await page.setContent(textHtml());
await page.screenshot({ path: path.join(here, TEXT.file), fullPage: true });
await browser.close();
console.log("rendered setup fixtures");
