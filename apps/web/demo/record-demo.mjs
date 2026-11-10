#!/usr/bin/env node
// Records the SupplyPilot product demo video by driving the real app with Playwright.
//
//   make demo-video            (from the repo root; needs `make db-start` + the app running)
//
// Env: DEMO_BASE_URL (default http://localhost:3000), DEMO_OUT (default demo/out/supplypilot-demo.mp4)
//
// Frames are captured with Chrome's screencast at 1920x1080 (JPEG q95), then stitched by
// ffmpeg with their real timestamps, so the result is far sharper than Playwright's
// built-in VP8 video. Everything shown is the synthetic demo dataset.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.env.DEMO_OUT ?? path.join(here, "out", "supplypilot-demo.mp4"));
const FRAMES = path.join(path.dirname(OUT), "frames");
const W = 1600;
const H = 900;
const SCALE = 1.2; // 1600x900 CSS px -> 1920x1080 frames

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Recording plumbing
// ---------------------------------------------------------------------------------------------
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  timezoneId: "America/New_York",
  bypassCSP: true, // the overlay styles itself inline; the app's CSP is nonce-only
  acceptDownloads: true,
});
await context.addInitScript({ content: readFileSync(path.join(here, "overlay.js"), "utf8") });
await context.addCookies([{ name: "sp_demo_org", value: "org_sundaycrumb", url: BASE }]);
const page = await context.newPage();

const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(FRAMES, `f${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

async function startRecording() {
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 95,
    maxWidth: W * SCALE,
    maxHeight: H * SCALE,
    everyNthFrame: 1,
  });
}

// Keep a frame flowing during long still shots (screencast only emits on repaint).
let ticking = true;
(async () => {
  while (ticking) {
    await page.evaluate(() => document.body?.offsetHeight).catch(() => {});
    await sleep(500);
  }
})();

// ---------------------------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------------------------
let mouse = { x: W / 2, y: H / 2 };

const overlay = (fn, ...args) =>
  page.evaluate(([f, a]) => window.__spDemo?.[f]?.(...a), [fn, args]).catch(() => {});

async function caption(kicker, text, hold = 0) {
  await overlay("caption", kicker, text);
  if (hold) await sleep(hold);
}

async function card(html, hold) {
  await overlay("card", html);
  await sleep(hold);
}

async function moveTo(x, y, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  mouse = { x, y };
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${locator}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function click(locator, { pause = 350, ms = 750 } = {}) {
  await scrollIntoView(locator);
  const { x, y } = await center(locator);
  await moveTo(x, y, ms);
  await sleep(pause);
  await overlay("ripple", x, y);
  await locator.click();
}

async function scrollIntoView(locator, block = "center") {
  await locator
    .first()
    .evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await sleep(900);
}

async function scrollTo(y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await sleep(1000);
}

async function spotlight(locator, hold = 2500) {
  await scrollIntoView(locator);
  const { box } = await center(locator);
  await overlay("highlight", box);
  await sleep(hold);
  await page.evaluate(() => window.__spDemoClearHighlight?.()).catch(() => {});
  await sleep(450);
}

async function type(locator, text) {
  await locator.pressSequentially(text, { delay: 110 });
}

async function goto(url) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.mouse.move(mouse.x, mouse.y);
}

async function pickDate(name) {
  await click(page.locator("label", { has: page.getByRole("radio", { name }) }));
  await page.getByRole("radio", { name }).waitFor();
  await sleep(700);
}

// Uses the header switcher like a person would (it signs in as that buyer's demo account).
async function switchBuyer(orgId) {
  const select = page.locator("#buyer-compact");
  await scrollTo(0);
  const { x, y } = await center(select);
  await moveTo(x, y);
  await sleep(300);
  await overlay("ripple", x, y);
  await Promise.all([page.waitForEvent("load"), select.selectOption(orgId)]);
  await page.waitForLoadState("networkidle");
  await page.mouse.move(mouse.x, mouse.y);
  await sleep(800);
}

async function uploadCsv(csv) {
  await goto("/cart");
  const chooser = page.waitForEvent("filechooser");
  await click(page.getByText("Choose CSV file").first(), { pause: 200 });
  await (
    await chooser
  ).setFiles({ name: "weekly-order.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText(/\d+\s*rows? ready/).waitFor();
  await sleep(1400);
  await click(
    page.getByRole("button", { name: /^(Replace cart with these \d+|Import \d+ items?)$/ }),
  );
  await page.getByRole("status", { name: "Updates" }).getByText("Imported").waitFor();
  await sleep(900);
}

async function findBestPrice() {
  await click(page.getByRole("button", { name: "Find My Best Price" }));
  await page.waitForURL(/\/results\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await sleep(800);
}

const TITLE = `
  <div style="display:flex;align-items:center;gap:18px">
    <div style="width:64px;height:64px;border-radius:16px;background:white;display:grid;place-items:center">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="oklch(0.42 0.085 165)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    </div>
    <div style="font-size:64px;font-weight:650;letter-spacing:-0.03em">SupplyPilot</div>
  </div>
  <div style="font-size:34px;font-weight:500;letter-spacing:-0.01em;opacity:.95">One shopping list. The smartest way to buy it.</div>
  <div style="margin-top:28px;font-size:18px;opacity:.7">Product demo · synthetic data: fictional buyers and suppliers</div>`;

const END = `
  <div style="font-size:52px;font-weight:650;letter-spacing:-0.03em">Lowest total delivered cost.<br/>And exactly why.</div>
  <div style="display:flex;gap:14px;margin-top:18px;font-size:20px;opacity:.92">
    <span style="padding:10px 18px;border:1px solid rgba(255,255,255,.35);border-radius:999px">Fees &amp; minimums</span>
    <span style="padding:10px 18px;border:1px solid rgba(255,255,255,.35);border-radius:999px">Pack sizes</span>
    <span style="padding:10px 18px;border:1px solid rgba(255,255,255,.35);border-radius:999px">Delivery days</span>
    <span style="padding:10px 18px;border:1px solid rgba(255,255,255,.35);border-radius:999px">Fresh data only</span>
    <span style="padding:10px 18px;border:1px solid rgba(255,255,255,.35);border-radius:999px">Draft POs</span>
  </div>
  <div style="margin-top:40px;font-size:30px;font-weight:600">SupplyPilot</div>`;

// ---------------------------------------------------------------------------------------------
// The demo
// ---------------------------------------------------------------------------------------------
// Prepare state off camera: Sunday Crumb's cart starts from its saved weekly list.
await goto("/lists");
await page
  .getByRole("listitem")
  .filter({ has: page.getByRole("heading", { name: "Weekly bake order", exact: true }) })
  .getByRole("button", { name: "Load into cart" })
  .click();
await page.waitForURL(/\/cart$/);
await goto("/");
await overlay("card", TITLE);
await sleep(300);

await startRecording();
const t0 = Date.now();

// 0. Title
await sleep(3600);
await card(null, 900);

// 1. Home
await caption(
  "The problem",
  "Independent bakeries and cafés buy from 3–5 distributors every week. Each has its own prices, packs, fees, minimums and delivery days.",
  5200,
);
await caption(
  "SupplyPilot",
  "The buyer builds one list. We find the lowest total delivered cost, and explain why.",
  3600,
);

// 2. Lists -> cart
await click(page.getByRole("link", { name: "Lists", exact: true }).first());
await page.waitForURL(/\/lists$/);
await sleep(600);
await caption(
  "1 · One list",
  "Sunday Crumb Bakery's saved weekly order: 14 items, each from the supplier they usually use.",
  2800,
);
await click(
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Weekly bake order", exact: true }) })
    .getByRole("button", { name: "Load into cart" }),
);
await page.waitForURL(/\/cart$/);
await page.waitForLoadState("networkidle");
await sleep(900);
await caption(
  "1 · One list",
  "That habit is the baseline. Every saving we show is measured against it, never an estimate.",
  3200,
);
await scrollTo(260);
await sleep(1200);
await scrollTo(0);

// 3. Keyboard search
await caption("Fast to edit", "Press / to search. Arrow keys and Enter to add.", 0);
await moveTo(W / 2 - 200, 352, 600);
await page.keyboard.press("/");
await sleep(500);
await type(page.getByRole("combobox").first(), "vanilla");
await sleep(900);
await page.keyboard.press("Enter");
await sleep(1600);

// 4. Delivery date
await caption(
  "2 · Delivery day",
  "Pick a date. We show which suppliers can deliver it, and why the others can't.",
  0,
);
await pickDate(/Tuesday, Nov 10/);
await spotlight(page.getByText("Tuesday, Nov 10", { exact: true }).locator("..").first(), 3800);
await scrollTo(0);

// 5. Best price (partial)
await caption(
  "3 · Find My Best Price",
  "One click. An exact optimizer prices every pack, fee, minimum and stock level.",
  0,
);
await findBestPrice();
await caption(
  "Honest results",
  "$1,316.33 for 13 of 14 items. Strawberries are left out, with the reason.",
  3400,
);
await spotlight(
  page
    .getByText(/couldn't be included/)
    .first()
    .locator(".."),
  3200,
);
await caption(
  "Honest results",
  "When your usual suppliers are already cheapest, we say so. We don't invent savings.",
  0,
);
await page.mouse.wheel(0, 0);
await scrollTo(520);
await sleep(2400);
await scrollTo(1100);
await sleep(2600);

// 6. Third Shift Coffee: cheapest items != cheapest basket
await switchBuyer("org_thirdshift");
await caption(
  "4 · Cheapest items ≠ cheapest order",
  "Third Shift Coffee uploads a spreadsheet: milk and oat milk for Wednesday.",
  0,
);
await uploadCsv("product,quantity,unit\nprd_milk_whole,16,gal\nprd_oat_milk,12,qt\n");
await scrollTo(0);
await pickDate(/Wednesday, Nov 11/);
await scrollTo(0);
await findBestPrice();
await caption("4 · Cheapest items ≠ cheapest order", "$132.60 delivered from Meadowlark.", 2200);
await spotlight(page.getByText(/Pelican has the lowest per-item price/).first(), 3800);
await caption(
  "4 · Cheapest items ≠ cheapest order",
  "Pelican's item prices are lower, but its $45 delivery fee makes it $18.30 more.",
  0,
);
await spotlight(
  page.getByRole("table", { name: "Alternative orders compared to the best price" }),
  4200,
);

// 7. Approve -> PO -> PDF
await caption(
  "5 · Plan to purchase order",
  "Approve the plan. Nothing is created until the buyer confirms.",
  0,
);
await click(page.getByRole("button", { name: "Approve plan" }));
await sleep(1600);
await click(page.getByRole("button", { name: /^Create \d+ draft POs?$/ }));
await sleep(1600);
await click(page.getByRole("link", { name: /^THI-\d{6}-\d{3} · Meadowlark/ }).first());
await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
await page.waitForLoadState("networkidle");
await sleep(700);
await caption(
  "5 · Plan to purchase order",
  "A draft PO with SKUs, packs, pack prices and the supplier's order cutoff.",
  3600,
);
await caption(
  "5 · Plan to purchase order",
  "Download it as PDF or CSV. SupplyPilot never sends anything to a supplier on its own.",
  0,
);
const download = page.waitForEvent("download");
await click(page.getByRole("button", { name: "Download PDF" }));
await download;
await sleep(1200);
await spotlight(page.getByText("Exported", { exact: true }).first(), 2400);
await caption(
  "Next week",
  "Reorder puts the same packs back in the cart, and next week's run measures savings against it.",
  3600,
);

// 8. End
await caption(null, null);
await card(END, 5200);

ticking = false;
await cdp.send("Page.stopScreencast");
await sleep(300);
const seconds = (Date.now() - t0) / 1000;
await browser.close();

// ---------------------------------------------------------------------------------------------
// Stitch frames with their real timing
// ---------------------------------------------------------------------------------------------
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const next = frames[i + 1]?.t ?? frames[i].t + 0.5;
  lines.push(
    `file '${frames[i].file}'`,
    `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`,
  );
}
lines.push(`file '${frames.at(-1).file}'`);
const list = path.join(FRAMES, "frames.txt");
writeFileSync(list, lines.join("\n"));
mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-vf",
    "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    OUT,
  ],
  { stdio: "inherit" },
);
if (!process.env.DEMO_KEEP_FRAMES) rmSync(FRAMES, { recursive: true, force: true });
console.log(`Wrote ${OUT} (${seconds.toFixed(0)}s, ${frames.length} frames)`);
