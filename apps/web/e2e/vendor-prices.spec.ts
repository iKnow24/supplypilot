import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { actAs } from "./helpers";

// The AI is a local mock (e2e/mock-anthropic.mjs); a deployed app would call the real one.
test.skip(!!process.env.E2E_BASE_URL, "needs the local mock AI");
test.use({ reducedMotion: "reduce" });

const FIXTURE = "e2e/fixtures/price-text.png";

function reviewLines(page: Page) {
  return page.locator('ol[aria-label="Lines read from the screenshot"] > li');
}

async function noAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("vendor prices: read a screenshot, review each line, save, and compare", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      cspViolations.push(m.text());
    }
  });
  await actAs(context, "org_sundaycrumb", baseURL!);

  await page.goto("/suppliers", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Add prices from a screenshot" }).click();
  await expect(page).toHaveURL(/\/suppliers\/import$/);
  await expect(page.getByRole("heading", { name: "Add prices from a screenshot" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await noAxeViolations(page);

  // Not an image: refused in the browser before anything is uploaded.
  const picker = page.getByLabel(/Choose an image/);
  await picker.setInputFiles({
    name: "x.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF"),
  });
  await expect(page.getByText("Use a PNG, JPG or WebP image")).toBeVisible();

  await picker.setInputFiles(FIXTURE);
  await expect(page.getByRole("img", { name: "The screenshot you picked" })).toBeVisible();
  await page.getByRole("button", { name: "Read prices" }).click();

  // The review screen: vendor, kind and date as read; every line editable.
  await expect(page.getByRole("heading", { name: "Check what was read" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Vendor", exact: true })).toHaveValue(
    "sup_bramblewood",
  );
  await expect(page.getByRole("combobox", { name: "Document" })).toHaveValue("text_message");
  await expect(page.getByRole("textbox", { name: /^Date on it/ })).toHaveValue("2026-11-08");
  const lines = reviewLines(page);
  await expect(lines).toHaveCount(4);
  // A per-pound price was multiplied out to the bag, exactly.
  await expect(lines.nth(0)).toContainText("Priced $0.420/lb × 50 lb");
  await expect(lines.nth(0).getByRole("textbox", { name: /^Pack price/ })).toHaveValue("21.00");
  await expect(lines.nth(0)).toContainText("Clear");
  await expect(lines.nth(3)).toContainText("Unclear");
  await expect(lines.nth(3)).toContainText("Pick the matching product");
  await noAxeViolations(page);

  // Approve the two clear lines in one go, reject the one we doubt.
  await page.getByRole("button", { name: "Approve 2 clear lines" }).click();
  await expect(lines.nth(0).getByRole("button", { name: "Approved line 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await lines.nth(2).getByRole("button", { name: "Reject line 3" }).click();

  // An unmatched line can't be approved until it's mapped to a product.
  await lines.nth(3).getByRole("button", { name: "Approve line 4" }).click();
  await expect(lines.nth(3).getByRole("alert")).toHaveText("Pick the matching product");
  await lines
    .nth(3)
    .getByRole("combobox", { name: "Product" })
    .selectOption({ label: "Pure vanilla extract" });
  await expect(lines.nth(3)).toContainText("= $2.44/fl oz");
  await lines.nth(3).getByRole("button", { name: "Approve line 4" }).click();

  await page.getByRole("button", { name: "Save 3 approved prices" }).click();
  await expect(page).toHaveURL(/\/suppliers\/import\?saved=[0-9a-f-]{36}$/);
  const banner = page
    .getByRole("status")
    .filter({ has: page.getByRole("link", { name: /^Compare / }) });
  await expect(banner).toContainText("Saved 3 prices from Bramblewood Baking Supply (Demo).");

  // The quote shows up where buyers compare vendors, dated and marked as theirs.
  await page.getByRole("link", { name: /Compare All-purpose flour, unbleached/ }).click();
  await expect(page).toHaveURL(/\/stock\/prd_flour_ap_unbl$/);
  const quote = page.getByRole("listitem").filter({ hasText: "Your quote" });
  await expect(quote).toHaveCount(1);
  await expect(quote).toContainText("$0.420");
  await expect(quote).toContainText("50 lb bag · $21.00 a pack");
  await expect(quote).toContainText("text message dated Sun, Nov 8");
  await expect(quote).toContainText("Lowest price");
  await expect(page.getByText("Price this order doesn't use them yet")).toBeVisible();

  await page.goto("/suppliers/sup_bramblewood");
  const quoted = page.getByRole("list", { name: "Your quoted prices from Bramblewood" });
  await expect(quoted.getByRole("listitem")).toHaveCount(3);
  await expect(quoted).toContainText("Pure vanilla extract");
  await expect(quoted).toContainText("$78.00");

  // Delete the import: its prices disappear everywhere.
  await page.goto("/suppliers/import");
  await page.getByText("Bramblewood Baking Supply (Demo)").first().click();
  await page.getByRole("button", { name: "Delete these 3 prices" }).first().click();
  await expect(page).toHaveURL(/\/suppliers\/import\?deleted=1$/);
  await page.goto("/stock/prd_flour_ap_unbl");
  await expect(page.getByRole("listitem").filter({ hasText: "Your quote" })).toHaveCount(0);

  expect(cspViolations).toEqual([]);
});
