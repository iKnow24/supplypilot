import { expect, test } from "@playwright/test";

import { actAs, findBestPrice, loadList, pickDate, replaceCartWithCsv, toast } from "./helpers";

// These run the real optimizer service. The synthetic catalog's clock is fixed
// (Thu Nov 5 2026, 9 AM Orlando), so prices, dates and totals are stable.

test("cheapest items aren't the cheapest basket: plan, reasons and alternatives", async ({
  page,
  context,
  baseURL,
}) => {
  // Demo scenario 1: Third Shift Coffee, whole milk + oat milk, Wednesday Nov 11.
  await actAs(context, "org_thirdshift", baseURL!);
  await replaceCartWithCsv(
    page,
    "product,quantity,unit\nprd_milk_whole,16,gal\nprd_oat_milk,12,qt\n",
  );
  await pickDate(page, /Wednesday, Nov 11/);
  await expect(page.getByRole("radio", { name: /Wednesday, Nov 11/ })).toBeChecked();
  await findBestPrice(page);

  const hero = page.getByRole("region", { name: /Lowest total delivered cost/ });
  await expect(hero).toContainText("$132.60");
  await expect(page.getByRole("heading", { name: "Meadowlark Dairy Co-op (Demo)" })).toBeVisible();
  await expect(page.getByText(/Pelican has the lowest per-item price/)).toBeVisible();

  const alternatives = page.getByRole("table", {
    name: "Alternative orders compared to the best price",
  });
  const cheapItems = alternatives.getByRole("row", { name: /Lowest item prices/ });
  await expect(cheapItems).toContainText("$150.90");
  await expect(cheapItems).toContainText("+$18.30");

  // The run is kept: it shows in history and on the cart.
  await page.goto("/results");
  await expect(page.getByRole("cell", { name: "$132.60" }).first()).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText(/Last result:/)).toContainText("$132.60");
});

test("one unfillable item doesn't sink the order", async ({ page, context, baseURL }) => {
  // Sunday Crumb's weekly list on Tuesday: strawberries only come from Citrus Row, whose $75
  // minimum 16 lb can't reach. The other 13 items still get the best price.
  await actAs(context, "org_sundaycrumb", baseURL!);
  await loadList(page, "Weekly bake order");
  await pickDate(page, /Tuesday, Nov 10/);
  await expect(page.getByRole("radio", { name: /Tuesday, Nov 10/ })).toBeChecked();
  await findBestPrice(page);

  await expect(page.getByText("1 item couldn't be included")).toBeVisible();
  await expect(page.getByText("Left out: Strawberries.")).toBeVisible();
  await expect(page.getByText(/Citrus Row's \$75\.00 minimum/)).toBeVisible();
  await expect(page.getByRole("region", { name: /for the items we could include/ })).toContainText(
    "$1,316.33",
  );

  await page.goto("/results");
  await expect(page.getByText("Partial").first()).toBeVisible();
});

test("the button says what's missing instead of failing", async ({ page, context, baseURL }) => {
  await actAs(context, "org_littlejuniper", baseURL!);
  const button = page.getByRole("button", { name: "Find My Best Price" });
  const note = page.locator("#best-price-note");

  // Put something in the cart so "Clear" exists, then clear it (which also clears the date).
  await replaceCartWithCsv(page, "product,quantity,unit\nprd_onion_yellow,100,lb\n");
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Yes, clear cart" }).click();
  await expect(toast(page)).toContainText("Cart cleared");
  await expect(button).toBeDisabled();
  await expect(note).toHaveText("Add something to your cart first.");

  await replaceCartWithCsv(page, "product,quantity,unit\nprd_onion_yellow,100,lb\n");
  await expect(button).toBeDisabled();
  await expect(note).toHaveText("Pick a delivery date to compare prices.");

  await pickDate(page, /Monday, Nov 9/);
  await expect(button).toBeEnabled();
});
