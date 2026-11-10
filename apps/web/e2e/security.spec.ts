import { expect, test } from "@playwright/test";

import { actAs, findBestPrice, pickDate, replaceCartWithCsv } from "./helpers";

test("pages send security headers with a fresh CSP nonce each time", async ({ request }) => {
  const a = await request.get("/");
  const b = await request.get("/");
  const csp = a.headers()["content-security-policy"]!;
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toBe(b.headers()["content-security-policy"]);
  expect(a.headers()["x-frame-options"]).toBe("DENY");
  expect(a.headers()["x-content-type-options"]).toBe("nosniff");
  expect(a.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(a.headers()["permissions-policy"]).toContain("camera=()");
  expect(a.headers()["x-powered-by"]).toBeUndefined();
});

test("nothing the app needs is blocked by its CSP", async ({ page, context, baseURL }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      violations.push(m.text());
    }
  });
  await actAs(context, "org_thirdshift", baseURL!);
  for (const path of ["/", "/home", "/lists", "/orders", "/suppliers", "/settings"]) {
    await page.goto(path, { waitUntil: "networkidle" });
  }
  // A full interactive flow proves scripts hydrated under the policy.
  await replaceCartWithCsv(page, "product,quantity,unit\nprd_milk_whole,16,gal\n");
  await pickDate(page, /Wednesday, Nov 11/);
  await expect(page.getByRole("radio", { name: /Wednesday, Nov 11/ })).toBeChecked();
  await findBestPrice(page);
  expect(violations).toEqual([]);
});

test("downloads and the CSV template are never cached or framed", async ({ request }) => {
  const res = await request.get("/cart/template.csv");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["cache-control"]).toContain("no-store");
});
