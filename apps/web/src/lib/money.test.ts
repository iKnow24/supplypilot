import { describe, expect, it } from "vitest";

import { formatCents, formatUnitPrice } from "./money";

describe("formatCents", () => {
  it("formats integer cents as USD", () => {
    expect(formatCents(268900)).toBe("$2,689.00");
    expect(formatCents(5)).toBe("$0.05");
  });
  it("refuses fractional cents", () => {
    expect(() => formatCents(10.5)).toThrow();
  });
});

describe("formatUnitPrice", () => {
  it("keeps sub-dollar precision", () => {
    expect(formatUnitPrice(9.15)).toBe("$0.092");
    expect(formatUnitPrice(1149.6)).toBe("$11.50");
  });
});
