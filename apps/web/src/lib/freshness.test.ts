import { describe, expect, it } from "vitest";

import { assessFreshness, formatAge } from "./freshness";

const now = new Date("2026-11-05T14:00:00Z");
const base = { now, priceMaxAgeHours: 336, inventoryMaxAgeHours: 36 };

describe("freshness policy", () => {
  it("passes current data", () => {
    expect(
      assessFreshness({
        ...base,
        priceUpdatedAt: new Date("2026-11-02T13:00:00Z"),
        inventoryAsOf: new Date("2026-11-05T11:00:00Z"),
      }),
    ).toEqual({ ok: true });
  });

  it("flags every problem, not just the first", () => {
    expect(
      assessFreshness({
        ...base,
        priceUpdatedAt: new Date("2026-10-01T00:00:00Z"),
        inventoryAsOf: null,
      }),
    ).toEqual({ ok: false, reasons: ["stale_price", "missing_inventory"] });
  });

  it("treats exactly-at-the-limit as still fresh", () => {
    const inv = new Date(now.getTime() - 36 * 3_600_000);
    expect(assessFreshness({ ...base, priceUpdatedAt: now, inventoryAsOf: inv }).ok).toBe(true);
  });

  it("formats ages in plain English", () => {
    expect(formatAge(new Date("2026-11-05T11:00:00Z"), now)).toBe("3 hours ago");
    expect(formatAge(new Date("2026-11-02T13:00:00Z"), now)).toBe("3 days ago");
  });
});
