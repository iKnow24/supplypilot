import { devices, expect, test } from "@playwright/test";

import { actAs, findBestPrice, pickDate, replaceCartWithCsv } from "./helpers";

test.use({ ...devices["Pixel 7"] });

async function noSideways(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

test("phone: no sideways scrolling, tab bar reachable, flow works", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await actAs(context, "org_sundaycrumb", baseURL!);

  for (const path of [
    "/",
    "/home",
    "/stock",
    "/lists",
    "/orders",
    "/results",
    "/suppliers",
    "/suppliers/sup_kestrel",
    "/settings",
    "/setup",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await noSideways(page, path);
  }

  // Bottom tab bar replaces the header nav on phones.
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabs.getByRole("link", { name: "Orders" })).toBeVisible();

  await replaceCartWithCsv(
    page,
    "product,quantity,unit\nprd_flour_ap_unbl,250,lb\nprd_sugar_gran_cane,50,lb\nprd_butter_unsalted,36,lb\n",
  );
  await noSideways(page, "/cart");
  await pickDate(page, /Tuesday, Nov 10/);
  await expect(page.getByRole("radio", { name: /Tuesday, Nov 10/ })).toBeChecked();
  await findBestPrice(page);
  await noSideways(page, "result");
  // The total is the first thing on screen, above the fold.
  const hero = page.getByRole("region", { name: /Lowest total delivered cost/ });
  const box = await hero.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
});
