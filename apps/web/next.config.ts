import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo catalog lives at <repo>/data/seed and is read from disk on the
  // server. Tracing from the repo root lets a production build include it.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
