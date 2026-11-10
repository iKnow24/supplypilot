import { expect, test } from "@playwright/test";

import { actAs, cartItems, findBestPrice, quantityOf, toast } from "./helpers";

test("stock: count a shelf, see the plan change, then price the drafted order", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  await actAs(context, "org_sundaycrumb", baseURL!);
  await page.goto("/stock?view=list", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: /^We drafted \d+ items? for / })).toBeVisible();
  await expect(page.getByText("Demo data: usage is a fictional estimate.")).toBeVisible();

  // An empty shelf turns into "runs out before the delivery".
  const row = page.getByRole("row").filter({ hasText: "Light brown sugar" });
  await row.getByRole("button", { name: "Update count for Light brown sugar" }).click();
  const input = page.getByRole("textbox", { name: /How much Light brown sugar do you have/ });
  await input.fill("abc");
  await input.press("Enter");
  await expect(row.getByText(/Use a number like 12/)).toBeVisible();
  await input.fill("0");
  await input.press("Enter");
  await expect(toast(page)).toContainText("Count saved for Light brown sugar");
  await expect(row).toContainText("Just counted");
  await expect(row).toContainText("Runs out first");

  // The drafted order becomes the cart, with the delivery date already picked.
  await page.getByRole("button", { name: "Price this order" }).click();
  await expect(page).toHaveURL(/\/cart\?from=stock$/);
  await expect(page.getByText("Drafted from your stock levels.")).toBeVisible();
  await expect(cartItems(page).filter({ hasText: "Light brown sugar" })).toHaveCount(1);
  await expect(quantityOf(page, "Light brown sugar")).not.toHaveValue("");

  await findBestPrice(page);
  await expect(page.getByRole("heading", { name: "Your best price" })).toBeVisible();
});

test("stock: changing the delivery date re-plans the order", async ({ page, context, baseURL }) => {
  await actAs(context, "org_sundaycrumb", baseURL!);
  await page.goto("/stock", { waitUntil: "networkidle" });
  const picker = page.getByLabel("Plan for delivery on");
  const later = await picker.locator("option").nth(3).getAttribute("value");
  await picker.selectOption(later!);
  await expect(page).toHaveURL(new RegExp(`/stock\\?for=${later}$`));
  await expect(picker).toHaveValue(later!);
});

test("stock: the pantry links each item to who sells it cheapest", async ({
  page,
  context,
  baseURL,
}) => {
  await actAs(context, "org_sundaycrumb", baseURL!);
  await page.goto("/stock", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Pantry", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: /^Large eggs, shell/ }).click();
  await expect(page).toHaveURL(/\/stock\/prd_eggs_large$/);
  await expect(page.getByRole("heading", { name: "Large eggs, shell" })).toBeVisible();
  const prices = page.getByRole("region", { name: "Who sells it cheapest right now" });
  await expect(prices.getByText("Lowest price")).toHaveCount(1);
  await expect(prices.getByText("Doesn't deliver to you")).toBeVisible();
});

test("home: shows what needs attention and the drafted order", async ({
  page,
  context,
  baseURL,
}) => {
  await actAs(context, "org_sundaycrumb", baseURL!);
  await page.goto("/home", { waitUntil: "networkidle" });
  const attention = page.getByRole("region", { name: "Needs attention" });
  await expect(attention.getByRole("link", { name: /All-purpose flour/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your next order" })).toContainText(
    /\d+ items for/,
  );
  await attention.getByRole("link", { name: /All-purpose flour/ }).click();
  await expect(page).toHaveURL(/\/stock\/prd_flour_ap_unbl$/);
});
