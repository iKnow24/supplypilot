import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, newNonce } from "./headers";

describe("contentSecurityPolicy", () => {
  it("production: nonce'd scripts and styles, no unsafe-*, no third parties, no framing", () => {
    const csp = contentSecurityPolicy("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).not.toMatch(/unsafe-/);
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("development allows only what React's dev tooling needs", () => {
    const csp = contentSecurityPolicy("n", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("makes a fresh, non-trivial nonce each time", () => {
    const a = newNonce();
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).not.toBe(newNonce());
  });
});
