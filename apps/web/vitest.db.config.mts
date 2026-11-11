import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Integration tests against local Supabase. Reads apps/web/.env.local (written by make db-env);
// Next's own loader deliberately skips .env.local when NODE_ENV=test.

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    environment: "node",
    // One database, shared demo orgs (and "Reset demo" wipes one): files run one at a time, like
    // the e2e tests, so one file's reset can't race another file's counts.
    fileParallelism: false,
    env: loadEnv("development", import.meta.dirname, ""),
  },
});
