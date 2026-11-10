import { expect, test } from "@playwright/test";

import { actAs, cartItems, toast } from "./helpers";

test("settings: reset demo puts the business back to how it starts", async ({
  page,
  context,
  baseURL,
}) => {
  await actAs(context, "org_sundaycrumb", baseURL!);

  // Some "demo" work: a shelf count.
  await page.goto("/stock?view=list", { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: "Whole milk" });
  await row.getByRole("button", { name: "Update count for Whole milk" }).click();
  await page.getByRole("textbox", { name: /How much Whole milk do you have/ }).fill("0");
  await page.getByRole("textbox", { name: /How much Whole milk do you have/ }).press("Enter");
  await expect(toast(page)).toContainText("Count saved for Whole milk");

  // Two taps, then Home.
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Yes, reset Sunday Crumb Bakery" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // The count is back to the seeded one, and the next order starts empty.
  await page.goto("/stock?view=list", { waitUntil: "networkidle" });
  await expect(page.getByRole("row").filter({ hasText: "Whole milk" })).not.toContainText(
    "Just counted",
  );
  await page.goto("/cart", { waitUntil: "networkidle" });
  await expect(cartItems(page)).toHaveCount(0);
});
