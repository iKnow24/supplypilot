import { expect, test } from "@playwright/test";

import { actAs, cartItems, loadList, pickDate, quantityOf, savedListCard, toast } from "./helpers";

// Little Juniper Kitchen (Demo): "Weekly kitchen order", 16 lines, zone Downtown Orlando.
// The synthetic catalog's clock is fixed at Thu Nov 5 2026 09:00 Orlando, so dates are stable.
const ORG = "org_littlejuniper";
const LIST = "Weekly kitchen order";

test.beforeEach(async ({ context, baseURL }) => {
  await actAs(context, ORG, baseURL!);
});

test("load a saved list, edit it, set a delivery date; it all persists", async ({ page }) => {
  await loadList(page, LIST);
  await expect(cartItems(page)).toHaveCount(16);

  // Edit: invalid input is explained and not saved; a valid one is.
  const first = cartItems(page).first();
  const qty = first.getByRole("textbox");
  const productName = (await qty.getAttribute("aria-label"))!.replace("Quantity of ", "");
  await qty.fill("0");
  await qty.press("Enter");
  await expect(first.getByText("Quantity must be more than 0")).toBeVisible();
  await expect(qty).toHaveAttribute("aria-invalid", "true");
  await qty.fill("42.5");
  await qty.press("Enter");
  await expect(qty).not.toHaveAttribute("aria-invalid");

  // Add by keyboard: search, Enter, focus jumps to the new line's quantity.
  const search = page.getByRole("combobox", { name: "Add products" });
  await search.fill("vanilla");
  await expect(
    page.getByRole("listbox", { name: "Matching products" }).getByRole("option").first(),
  ).toContainText(/vanilla/i);
  await search.press("Enter");
  await expect(toast(page)).toContainText(/Added .*vanilla/i);
  const vanilla = page.getByRole("textbox", { name: /Quantity of .*vanilla/i });
  await expect(vanilla).toBeFocused();
  await vanilla.fill("3");
  await vanilla.press("Tab");
  await expect(cartItems(page)).toHaveCount(17);

  // Delivery date: Tuesday Nov 10 — the picker explains who can deliver.
  await pickDate(page, /Tuesday, Nov 10/);
  await expect(page.getByRole("radio", { name: /Tuesday, Nov 10/ })).toBeChecked();
  await expect(page.getByRole("list", { name: "Who can deliver" })).toContainText("Order by");

  // Everything survived a full reload (it's in Postgres, not component state).
  await page.reload();
  await expect(quantityOf(page, productName)).toHaveValue("42.5");
  await expect(page.getByRole("textbox", { name: /Quantity of .*vanilla/i })).toHaveValue("3");
  await expect(page.getByRole("radio", { name: /Tuesday, Nov 10/ })).toBeChecked();
  await expect(page.getByText("Tue, Nov 10")).toBeVisible();
});

test("excluding a supplier updates who can deliver", async ({ page }) => {
  await page.goto("/cart");
  const group = page.getByRole("radiogroup", { name: "Kestrel" });
  await group.getByText("Exclude").click();
  await expect(group.getByRole("radio", { name: "Exclude" })).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("radiogroup", { name: "Kestrel" }).getByRole("radio", { name: "Exclude" }),
  ).toBeChecked();
  // Put it back for other tests.
  await page.getByRole("radiogroup", { name: "Kestrel" }).getByText("Allow").click();
  await expect(
    page.getByRole("radiogroup", { name: "Kestrel" }).getByRole("radio", { name: "Allow" }),
  ).toBeChecked();
});

test("CSV upload shows per-row errors and imports only valid rows", async ({ page }) => {
  await loadList(page, LIST);
  const csv = [
    "product,quantity,unit",
    "prd_flour_ap_unbl,50,lb",
    "prd_not_real,1,lb",
    "prd_flour_ap_unbl,10,gal",
    "prd_eggs_large,2.5,each",
    "prd_vanilla,,fl oz",
  ].join("\n");
  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "order.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/1\s*row ready, 3 with problems, 1 skipped/)).toBeVisible();
  const errors = page.getByRole("table", { name: "Rows that can't be imported" });
  await expect(errors).toContainText('Unknown product "prd_not_real"');
  await expect(errors).toContainText("can't be measured in gallons");
  await expect(errors).toContainText("whole items");

  await page.getByRole("button", { name: "Replace cart with these 1" }).click();
  await expect(toast(page)).toContainText("Imported 1 item");
  await expect(cartItems(page)).toHaveCount(1);
  await expect(page.getByText("Baseline", { exact: true }).locator("..")).toContainText("None");
});

test("the CSV template downloads with every product", async ({ request }) => {
  const res = await request.get("/cart/template.csv");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const body = await res.text();
  expect(body.split("\r\n")[0]).toBe("product_id,product_name,quantity,unit");
  expect(body).toContain("prd_flour_ap_unbl");
});

test("save the cart as a list, duplicate it, delete both", async ({ page }) => {
  await loadList(page, LIST);
  const name = `E2E list ${Date.now()}`;
  await page.getByRole("button", { name: "Save as list" }).click();
  await page.getByRole("textbox", { name: "List name" }).fill(name);
  await page.getByRole("button", { name: "Save list" }).click();
  await expect(toast(page)).toContainText(`Saved “${name}”`);

  await page.goto("/lists");
  const card = (n: string) => savedListCard(page, n);
  await expect(card(name)).toContainText("16 items");
  await card(name).getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: `${name} (copy)` })).toBeVisible();

  for (const n of [`${name} (copy)`, name]) {
    await card(n).getByRole("button", { name: "Delete" }).click();
    await card(n)
      .getByRole("button", { name: `Yes, delete “${n}”` })
      .click();
    await expect(page.getByRole("heading", { name: n, exact: true })).toHaveCount(0);
  }
});

test("buyers never see each other's lists", async ({ page, context, baseURL }) => {
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: LIST })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekly café restock" })).toHaveCount(0);

  // Switch through the real control: full reload, new identity, other buyer's data only.
  await page.getByRole("combobox", { name: "Ordering for" }).selectOption("org_thirdshift");
  await expect(page.getByRole("heading", { name: "Weekly café restock" })).toBeVisible();
  await expect(page.getByRole("heading", { name: LIST })).toHaveCount(0);

  // Leave the shared browser context on our buyer.
  await actAs(context, ORG, baseURL!);
});
