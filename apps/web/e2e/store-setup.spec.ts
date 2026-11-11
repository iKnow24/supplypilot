import { readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { actAs } from "./helpers";

// The AI is a local mock (e2e/mock-anthropic.mjs) that answers with the reading of each fixture
// in e2e/fixtures/setup; a deployed app would call the real one.
test.skip(!!process.env.E2E_BASE_URL, "needs the local mock AI");
test.use({ reducedMotion: "reduce" });

const ORG = "org_orangeblossom"; // a brand-new demo bakery: no lists, stock or prices
const DIR = "e2e/fixtures/setup";
const FILES = [
  "inventory-count.csv",
  "bramblewood-invoice-oct-27.pdf",
  "bramblewood-invoice-nov-3.png",
  "meadowlark-invoice-nov-2.pdf",
  "lake-ivanhoe-farms-text.png",
].map((f) => path.join(DIR, f));

async function noAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(", ")})`,
    ),
  ).toEqual([]);
}

test("a new bakery sets up from its own documents, reviews them, and lands on a drafted order", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      cspViolations.push(m.text());
    }
  });
  await actAs(context, ORG, baseURL!, { autopilot: "auto" });

  // On a fresh database, Home has nothing to show yet and points at setup. (Run again, the
  // bakery is already set up, so go straight there: setting up again replaces the last one.)
  await page.goto("/home", { waitUntil: "networkidle" });
  const start = page.getByRole("link", { name: "Set up from your documents" });
  if (await start.isVisible()) {
    await expect(page.getByRole("heading", { name: /Let's set up your store/ })).toBeVisible();
    await noAxeViolations(page);
    await start.click();
  } else {
    await page.goto("/setup");
  }
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Set up from your documents" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await noAxeViolations(page);

  // Several files at once. A Word file is refused in the browser; a photo with nothing useful
  // in it fails on its own without sinking the rest.
  const picker = page.getByLabel(/Choose files/);
  await picker.setInputFiles({
    name: "menu.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("PK"),
  });
  const docs = page.getByRole("list", { name: "Your documents" });
  await expect(docs.getByRole("listitem").filter({ hasText: "menu.docx" })).toContainText(
    "use a photo (PNG, JPG, WebP), a PDF, or a CSV or Excel (.xlsx) sheet",
  );
  await page.getByRole("button", { name: "Remove menu.docx" }).click();
  await picker.setInputFiles(FILES);
  await picker.setInputFiles({
    name: "team-photo.png",
    mimeType: "image/png",
    buffer: readFileSync(path.join(DIR, "lake-ivanhoe-farms-text.png")),
  });
  await expect(docs.getByRole("listitem")).toHaveCount(6);

  await page.getByRole("button", { name: "Read 6 documents" }).click();
  const row = (name: string) => docs.getByRole("listitem").filter({ hasText: name });
  await expect(row("team-photo.png")).toContainText("Nothing about items you buy", {
    timeout: 30_000,
  });
  await expect(row("inventory-count.csv")).toContainText("Inventory count · 13 lines");
  await expect(row("bramblewood-invoice-oct-27.pdf")).toContainText(
    "Invoice from Bramblewood Baking Supply · 7 lines",
  );
  await expect(row("lake-ivanhoe-farms-text.png")).toContainText(
    "Text message from Lake Ivanhoe Farms · 1 line",
  );
  await page.getByRole("button", { name: "Remove team-photo.png" }).click();
  await page.getByRole("button", { name: "Review what we found (5 documents)" }).click();

  // One review screen for everything.
  await expect(page.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  const items = page.getByRole("list", { name: "Your items" });
  const flour = items.getByRole("listitem", { name: "AP flour unbleached (50 lb bags)" });
  await expect(flour.getByRole("combobox", { name: /^Product for/ })).toHaveValue(
    "prd_flour_ap_unbl",
  );
  // 3 bags × 50 lb on the count; 12 bags over two weeks of invoices.
  await expect(flour.getByRole("textbox", { name: /^On hand of/ })).toHaveValue("150");
  await expect(flour.getByRole("textbox", { name: /^Weekly use of/ })).toHaveValue("300");
  await expect(flour.getByRole("textbox", { name: /^Usual order of/ })).toHaveValue("300");
  await expect(flour).toContainText("600 lb on 2 invoices over 2 weeks");
  await expect(flour).toContainText("3 × 50 lb bag · inventory-count.csv");
  const eggs = items.getByRole("listitem", { name: "Large eggs" });
  await expect(eggs).toContainText("assumes you order it every week");

  // Not in the catalog (or not sure): kept, never dropped. The buyer matches the salt.
  const unmatched = page.getByRole("list", { name: "Not matched yet" });
  await expect(unmatched.getByRole("listitem")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Product for Kosher salt (3 lb box)" })
    .selectOption({ label: "Kosher salt" });
  await expect(unmatched.getByRole("listitem")).toHaveCount(2);
  const salt = items.getByRole("listitem", { name: "Kosher salt (3 lb box)" });
  await expect(salt.getByRole("textbox", { name: /^On hand of/ })).toHaveValue("6");
  await salt.getByRole("textbox", { name: /^Weekly use of/ }).fill("3");
  await expect(salt.getByRole("textbox", { name: /^Usual order of/ })).toHaveValue("3");

  // A wrong number blocks saving until it's fixed.
  const milk = items.getByRole("listitem", { name: "Whole milk" });
  await milk.getByRole("textbox", { name: /^On hand of/ }).fill("lots");
  await expect(milk).toContainText("On hand: use a number like 12 or 2.5");
  const save = page.getByRole("button", { name: "Save and set up my store" });
  await expect(save).toBeDisabled();
  await milk.getByRole("textbox", { name: /^On hand of/ }).fill("3");
  await expect(save).toBeEnabled();

  // Vendors and their dated prices, and the invoices as past orders.
  const farm = page.getByRole("list", { name: "Lines from lake-ivanhoe-farms-text.png" });
  await expect(farm.getByRole("textbox", { name: /^Price of/ })).toHaveValue("47.25");
  await expect(page.getByRole("textbox", { name: "Vendor name" })).toHaveValue(
    "Lake Ivanhoe Farms",
  );
  const past = page.getByRole("list", { name: "Past orders from your invoices" });
  await expect(past.getByRole("listitem")).toHaveCount(3);
  await expect(past).toContainText("$548.10");
  await expect(past).toContainText("$322.40");
  await noAxeViolations(page);

  await save.click();
  await expect(page).toHaveURL(/\/home\?setup=done$/, { timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Your store is set up" })).toContainText(
    "12 items, plus 2 not matched yet",
  );

  // Autopilot drafts and prices the next order by itself (or shows the plan it already made).
  const card = page.getByRole("region", { name: /Your next order/ });
  await expect(
    card.getByRole("heading", { name: "Your next order is priced and ready to approve" }),
  ).toBeVisible({ timeout: 45_000 });
  await noAxeViolations(page);

  // Stock runs on the bakery's own items and usage, and lists what isn't matched.
  await page.goto("/stock?view=list");
  await expect(page.getByText("All-purpose flour, unbleached").first()).toBeVisible();
  await expect(page.getByText("estimated from your invoices")).toBeVisible();
  const notMatched = page.getByRole("region", { name: /Not matched yet/ });
  await expect(notMatched).toContainText("Lavender buds");
  await expect(notMatched).toContainText("Counted 3 oz.");
  await expect(notMatched).toContainText("Bought 1 × 4 oz bag at $16.25 from Bramblewood");

  // Orders: the usual order list, the invoices, and the bakery's own vendors.
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Usual order", exact: true })).toBeVisible();
  await page.goto("/orders");
  const invoices = page.getByRole("region", { name: "From your invoices" });
  await expect(invoices.getByRole("listitem").filter({ hasText: "Bramblewood" })).toHaveCount(2);
  await expect(invoices).toContainText("Meadowlark Dairy Co-op");
  await page.goto("/suppliers");
  await expect(page.getByRole("region", { name: "Your vendors" })).toContainText(
    "Lake Ivanhoe Farms",
  );
  await expect(page.getByRole("region", { name: "Your vendors" })).toContainText("Your own vendor");

  expect(cspViolations).toEqual([]);
});
