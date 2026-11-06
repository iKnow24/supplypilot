import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { actAs, cartItems, findBestPrice, pickDate, replaceCartWithCsv, toast } from "./helpers";

test("approve a plan, export the PO, then reorder it", async ({ page, context, baseURL }) => {
  // Demo scenario 1: everything comes from Meadowlark, so one PO.
  await actAs(context, "org_thirdshift", baseURL!);
  await replaceCartWithCsv(
    page,
    "product,quantity,unit\nprd_milk_whole,16,gal\nprd_oat_milk,12,qt\n",
  );
  await pickDate(page, /Wednesday, Nov 11/);
  await expect(page.getByRole("radio", { name: /Wednesday, Nov 11/ })).toBeChecked();
  await findBestPrice(page);

  // Explicit approve step: nothing is created until the buyer confirms.
  await page.getByRole("button", { name: "Approve plan" }).click();
  await expect(page.getByText("Meadowlark Dairy Co-op (Demo)").last()).toBeVisible();
  await page.getByRole("button", { name: "Create 1 draft PO" }).click();
  await expect(toast(page)).toContainText("Created 1 draft purchase order");

  const poLink = page.getByRole("link", { name: /^THI-\d{6}-\d{3} · Meadowlark/ });
  await expect(poLink).toBeVisible();
  await poLink.click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByText("$132.60").last()).toBeVisible();

  // Exporting downloads the file and marks the PO Exported.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^THI-\d{6}-\d{3}-Meadowlark-Dairy-Co-op\.csv$/);
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Supplier,Meadowlark Dairy Co-op (Demo)");
  expect(csv.trim().split("\r\n").at(-1)).toBe(",,,,,Total,132.60");
  await expect(page.getByText("Exported", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(0);

  // It's in the order history.
  await page.goto("/orders");
  await expect(page.getByRole("row", { name: /Meadowlark/ }).first()).toContainText("Exported");

  // Reorder puts the packs back in the cart, with Meadowlark as the usual supplier.
  await page
    .getByRole("row", { name: /Meadowlark/ })
    .first()
    .getByRole("link")
    .click();
  await page.getByRole("button", { name: "Reorder" }).click();
  await page.getByRole("button", { name: "Yes, replace my cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(cartItems(page)).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "Quantity of Whole milk" })).toHaveValue("16");
  await expect(cartItems(page).first()).toContainText("usually from Meadowlark");
});

test("a draft can be discarded", async ({ page, context, baseURL }) => {
  await actAs(context, "org_littlejuniper", baseURL!);
  // Demo scenario 4: Citrus Row, Monday Nov 9.
  await replaceCartWithCsv(
    page,
    "product,quantity,unit\nprd_onion_yellow,100,lb\nprd_tomato_roma,25,lb\n",
  );
  await pickDate(page, /Monday, Nov 9/);
  await expect(page.getByRole("radio", { name: /Monday, Nov 9/ })).toBeChecked();
  await findBestPrice(page);
  await page.getByRole("button", { name: "Approve plan" }).click();
  await page.getByRole("button", { name: "Create 1 draft PO" }).click();
  const link = page.getByRole("link", { name: /· Citrus Row/ });
  const number = (await link.textContent())!.split(" · ")[0]!;
  await link.click();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Yes, discard this draft" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole("link", { name: number })).toHaveCount(0);
});
