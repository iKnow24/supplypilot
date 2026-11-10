// Renders price-text.html to price-text.png (the e2e upload fixture).
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 100 }, deviceScaleFactor: 2 });
await page.goto(`file://${path.join(here, "price-text.html")}`);
await page.screenshot({ path: path.join(here, "price-text.png"), fullPage: true });
await browser.close();
