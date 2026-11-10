import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Pick the demo buyer before the first request; the proxy signs in as its demo account.
 * Autopilot waits for a tap unless `autopilot: "auto"`: a plan running in the background would
 * rewrite the cart under the other tests.
 */
export async function actAs(
  context: BrowserContext,
  orgId: string,
  baseURL: string,
  opts: { autopilot?: "auto" | "manual" } = {},
) {
  await context.addCookies([
    { name: "sp_demo_org", value: orgId, url: baseURL },
    ...(opts.autopilot === "auto"
      ? []
      : [{ name: "sp_autopilot_manual", value: "1", url: baseURL }]),
  ]);
}

/** Load a saved list into the cart from the Lists page (resets the cart's lines). */
export async function loadList(page: Page, listName: string) {
  await page.goto("/lists");
  await savedListCard(page, listName).getByRole("button", { name: "Load into cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText(`loaded from “${listName}”`)).toBeVisible();
}

export function cartItems(page: Page) {
  return page.getByRole("list", { name: "Items in your cart" }).getByRole("listitem");
}

export function quantityOf(page: Page, product: string) {
  return page.getByRole("textbox", { name: `Quantity of ${product}` });
}

export function savedListCard(page: Page, name: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/** The cart's toast / live region. */
export function toast(page: Page) {
  return page.getByRole("status", { name: "Updates" });
}

/** Date chips are visually-hidden radios inside labels; click the label like a person would. */
export async function pickDate(page: Page, accessibleName: RegExp) {
  await page.locator("label", { has: page.getByRole("radio", { name: accessibleName }) }).click();
}

export async function replaceCartWithCsv(page: Page, csv: string) {
  // networkidle: let React hydrate first, or the file input's change event is lost.
  await page.goto("/cart", { waitUntil: "networkidle" });
  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "order.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/\d+\s*rows? ready/)).toBeVisible();
  // Empty cart: "Import N items"; otherwise replace what's there.
  await page
    .getByRole("button", { name: /^(Replace cart with these \d+|Import \d+ items?)$/ })
    .click();
  await expect(toast(page)).toContainText("Imported");
}

export async function findBestPrice(page: Page) {
  await page.getByRole("button", { name: "Find My Best Price" }).click();
  await expect(page).toHaveURL(/\/results\/[0-9a-f-]{36}$/, { timeout: 30_000 });
}
