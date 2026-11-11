import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real app + the optimizer service + local Supabase
 * (make db-start first). Locally this reuses servers on :3100 / :8000 if they're running;
 * CI builds and starts them. A reused :3100 must have been started with the env below
 * (ANTHROPIC_BASE_URL pointing at the mock AI), or the screenshot import test fails.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const OPTIMIZER_PORT = Number(process.env.E2E_OPTIMIZER_PORT ?? 8000);
// A local stand-in for the Anthropic API: e2e never calls the real AI (e2e/mock-anthropic.mjs).
const MOCK_AI_PORT = Number(process.env.E2E_MOCK_AI_PORT ?? 4010);
const CI = !!process.env.CI;
// Point at an existing deployment instead of starting local servers, e.g.
//   E2E_BASE_URL=https://supplypilot-nu.vercel.app npx playwright test
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests share demo buyers' carts in one database
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    timezoneId: "America/New_York",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: REMOTE
    ? undefined
    : [
        {
          // The price optimizer (Python). Next.js calls it server-to-server.
          command: `uv run --directory ../../services/optimizer uvicorn supplypilot_optimizer.api:app --port ${OPTIMIZER_PORT}`,
          url: `http://127.0.0.1:${OPTIMIZER_PORT}/v1/health`,
          reuseExistingServer: !CI,
          timeout: 120_000,
        },
        {
          command: `node e2e/mock-anthropic.mjs ${MOCK_AI_PORT}`,
          url: `http://127.0.0.1:${MOCK_AI_PORT}/health`,
          reuseExistingServer: !CI,
          timeout: 10_000,
        },
        {
          command: CI
            ? `npm run build && npm run start -- -p ${PORT}`
            : `npm run dev -- -p ${PORT}`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: !CI,
          timeout: 180_000,
          env: {
            OPTIMIZER_URL: `http://127.0.0.1:${OPTIMIZER_PORT}`,
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_AI_PORT}`,
            ANTHROPIC_API_KEY: "test-key-for-the-mock",
            PRICE_READS_PER_HOUR: "1000",
            SETUP_READS_PER_HOUR: "1000",
            AUTOPILOT_AI_RUNS_PER_HOUR: "1000",
          },
        },
      ],
});
