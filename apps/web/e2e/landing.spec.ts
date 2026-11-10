import { expect, test } from "@playwright/test";

// The public landing page: says what the product is, and every call to action opens the app.
test("landing page explains the product and opens the demo", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/SupplyPilot/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("every delivery");
  for (const name of [/Everything that changes the price/, /three steps/, /don.t invent savings/]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  // It never claims real suppliers or orders.
  await expect(page.getByText(/Fictional suppliers/).first()).toBeVisible();

  await page.getByRole("link", { name: "Open the live demo" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /^Good (morning|afternoon|evening)\./,
  );
  // The app's logo leads back to the app, not the marketing page.
  await expect(page.getByRole("link", { name: "SupplyPilot home" }).first()).toHaveAttribute(
    "href",
    "/home",
  );
});
