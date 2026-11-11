import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { actAs, findBestPrice, pickDate, replaceCartWithCsv } from "./helpers";

// WCAG 2.1 A + AA rules on every screen, including a real result and a real PO.
// Reduced motion: axe must measure final colors, not text caught mid fade-in.
test.use({ reducedMotion: "reduce" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const found: unknown[] = [];

async function scan(page: Page, label: string) {
  // Next streams metadata: let the <title> arrive before judging the page.
  await expect(page).toHaveTitle(/SupplyPilot/);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    page: label,
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  found.push(...summary);
}

test("every screen passes WCAG 2.1 AA automated checks", async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  await actAs(context, "org_thirdshift", baseURL!);

  // A cart with items and a date, then a real result and PO to scan.
  await replaceCartWithCsv(
    page,
    "product,quantity,unit\nprd_milk_whole,16,gal\nprd_oat_milk,12,qt\n",
  );
  await pickDate(page, /Wednesday, Nov 11/);
  await expect(page.getByRole("radio", { name: /Wednesday, Nov 11/ })).toBeChecked();
  await scan(page, "cart");

  await findBestPrice(page);
  await page
    .locator("details")
    .evaluateAll((els) => els.forEach((d) => d.setAttribute("open", "")));
  await scan(page, "result");
  await page.getByRole("button", { name: "Approve plan" }).click();
  await scan(page, "result (approving)");
  await page.getByRole("button", { name: /^Create \d+ draft POs?$/ }).click();
  await page
    .getByRole("link", { name: /^THI-\d{6}-\d{3} · / })
    .first()
    .click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await scan(page, "purchase order");

  for (const [path, label] of [
    ["/", "landing"],
    ["/home", "home"],
    ["/stock", "stock"],
    ["/lists", "saved lists"],
    ["/results", "past results"],
    ["/orders", "orders"],
    ["/suppliers", "suppliers"],
    ["/suppliers/sup_meadowlark", "supplier detail"],
    ["/settings", "settings"],
    ["/setup", "set up from your documents"],
    ["/does-not-exist", "not found"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    await scan(page, label);
  }
  expect(found, JSON.stringify(found, null, 2)).toEqual([]);
});
