import { expect, test } from "@playwright/test";

import { actAs, cartItems, replaceCartWithCsv, toast } from "./helpers";

// The core flow without a mouse: skip link, "/" search, add, edit, pick a date, run.

test("the whole cart flow works from the keyboard", async ({ page, context, baseURL }) => {
  await actAs(context, "org_thirdshift", baseURL!);
  await replaceCartWithCsv(page, "product,quantity,unit\nprd_milk_whole,16,gal\n");

  // From a fresh page load, the first Tab lands on the skip link, which moves focus to main.
  await page.goto("/cart", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  // "/" jumps to search; arrows + Enter add; focus lands on the new line's quantity.
  await page.keyboard.press("/");
  const search = page.getByRole("combobox", { name: "Add products" });
  await expect(search).toBeFocused();
  await page.keyboard.type("oat milk");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(toast(page)).toContainText("Added Oat milk");
  const qty = page.getByRole("textbox", { name: "Quantity of Oat milk, barista" });
  await expect(qty).toBeFocused();
  await page.keyboard.type("12");
  await page.keyboard.press("Enter");
  await expect(cartItems(page)).toHaveCount(2);

  // Escape abandons an edit and restores the saved value.
  await qty.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("999");
  await page.keyboard.press("Escape");
  await expect(qty).toHaveValue("12");

  // Delivery date: focus the radio group, arrows move the selection.
  const first = page.getByRole("radio", { name: /Friday, Nov 6/ });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.keyboard.press("ArrowRight"); // Sat Nov 7
  await expect(page.getByRole("radio", { name: /Saturday, Nov 7/ })).toBeChecked();

  // Run it with Enter.
  const run = page.getByRole("button", { name: "Find My Best Price" });
  await run.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/results\/[0-9a-f-]{36}$/, { timeout: 30_000 });
});

test("every interactive control shows a visible focus ring", async ({ page, context, baseURL }) => {
  await actAs(context, "org_thirdshift", baseURL!);
  await page.goto("/cart", { waitUntil: "networkidle" });
  const missing: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      // Skip the page itself and Next's dev-only overlay (absent from production builds).
      if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
      // The focus ring may be drawn on the element or on a wrapping label (sr-only inputs).
      const target = el.matches(".sr-only") ? (el.closest("label") ?? el) : el;
      const s = getComputedStyle(target);
      const ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow !== "none";
      return {
        ok: ring || shadow,
        name:
          el.getAttribute("aria-label") ||
          el.textContent?.trim().slice(0, 40) ||
          `<${el.tagName.toLowerCase()} type=${el.getAttribute("type")} class=${el.className}>`,
      };
    });
    if (info && !info.ok) missing.push(info.name);
  }
  expect(missing).toEqual([]);
});
