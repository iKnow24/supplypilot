import { describe, expect, it } from "vitest";

import { untouchedSinceLastPricing } from "./autostart";

const flour = { product_id: "prd_flour", quantity: "100", unit: "lb" };
const eggs = { product_id: "prd_eggs", quantity: "30", unit: "dozen" };

describe("untouchedSinceLastPricing", () => {
  it("starts on an empty order", () => {
    expect(untouchedSinceLastPricing([], null)).toBe(true);
  });

  it("starts when the order is exactly what was last priced, in any order", () => {
    expect(untouchedSinceLastPricing([flour, eggs], [eggs, { ...flour, quantity: "100.0" }])).toBe(
      true,
    );
  });

  it("waits when the buyer changed, added or removed anything, or it was never priced", () => {
    expect(untouchedSinceLastPricing([{ ...flour, quantity: "120" }, eggs], [flour, eggs])).toBe(
      false,
    );
    expect(untouchedSinceLastPricing([flour, eggs], [flour])).toBe(false);
    expect(untouchedSinceLastPricing([flour], [flour, eggs])).toBe(false);
    expect(untouchedSinceLastPricing([flour], null)).toBe(false);
  });
});
