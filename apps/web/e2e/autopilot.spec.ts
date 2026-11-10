import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { actAs } from "./helpers";

// Claude is a local mock (e2e/mock-anthropic.mjs) that plays a fixed agent; a deployed app
// would call the real API.
test.skip(!!process.env.E2E_BASE_URL, "needs the local mock AI");
test.use({ reducedMotion: "reduce" });

async function noAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("autopilot: one tap plans and prices the order, the buyer approves the POs", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      cspViolations.push(m.text());
    }
  });
  await actAs(context, "org_littlejuniper", baseURL!);
  await page.goto("/home", { waitUntil: "networkidle" });
  const card = page.getByRole("region", { name: /Your next order/ });
  await expect(card).toBeVisible();
  await noAxeViolations(page);

  // A previous run's plan may still be showing; either way one tap starts a fresh run.
  await card.getByRole("button", { name: /Plan it for me|Run again/ }).click();

  // Each step lands as it finishes, then the plan.
  await expect(
    card.getByRole("heading", { name: "Your next order is priced and ready to approve" }),
  ).toBeVisible({ timeout: 30_000 });
  const suppliers = card.getByRole("list", { name: "Suppliers in this plan" });
  await expect(suppliers.getByRole("listitem").first()).toBeVisible();
  await expect(card.getByRole("list", { name: "Autopilot's notes" })).toContainText(
    "Split across suppliers so each one's minimum is met.",
  );
  await expect(card).toContainText(/\$[\d,]+\.\d\d/);

  // What the agent did, step by step, is one click away.
  await card.getByText(/steps · see what Autopilot did/).click();
  const steps = card.getByRole("log", { name: "Autopilot steps" });
  for (const step of [
    "Checking the pantry first.",
    "Checking your pantry",
    "Drafting the order",
    "Checking your vendor quotes",
    "Pricing it across every supplier",
    "Laying out the plan",
  ]) {
    await expect(steps).toContainText(step);
  }
  await expect(steps).toContainText(/items for .*Your Smart Cart now holds this order/);
  await noAxeViolations(page);

  // Nothing is a PO until the buyer approves.
  const approve = card.getByRole("button", { name: /^Approve and create \d+ draft POs?$/ });
  const n = Number((await approve.textContent())!.match(/create (\d+)/)![1]);
  await approve.click();
  const open = card.getByRole("link", { name: new RegExp(`${n} draft POs? ready`) });
  await expect(open).toBeVisible();

  // The plan survives a reload, already approved.
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page
      .getByRole("region", { name: /Your next order/ })
      .getByRole("link", { name: /draft POs? ready/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: /draft POs? ready/ }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText("Draft").first()).toBeVisible();

  expect(cspViolations).toEqual([]);
});

test("autopilot: the Stock page offers it too", async ({ page, context, baseURL }) => {
  await actAs(context, "org_sundaycrumb", baseURL!);
  await page.goto("/stock", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Or let Autopilot plan and price it" }).click();
  await expect(page).toHaveURL(/\/home#autopilot$/);
  await expect(page.getByRole("region", { name: /Your next order/ })).toBeVisible();
});
