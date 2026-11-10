import path from "node:path";
import type { NextConfig } from "next";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Price screenshots are posted to a server action (capped at 3.5 MB in the action itself).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    // The per-request Content-Security-Policy (with its nonce) is set in src/proxy.ts.
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
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
