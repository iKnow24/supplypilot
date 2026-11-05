import { describe, expect, it } from "vitest";

import type { DeliveryPolicy } from "./catalog/schema";
import { checkDelivery, isoWeekday, nextDeliveryDates } from "./delivery";

const TZ = "America/New_York";
// Thursday Nov 5 2026, 9:00 AM Orlando
const now = new Date("2026-11-05T09:00:00-05:00");

const policy: DeliveryPolicy = {
  zones: ["ORL-WP"],
  delivery_weekdays: [2, 4, 6], // Tue, Thu, Sat
  cutoff_local_time: "12:00",
  lead_days: 1,
  delivery_window: { start: "07:00", end: "11:00" },
  min_order_cents: 25000,
  delivery_fee_cents: 2500,
  free_delivery_threshold_cents: 50000,
};

describe("delivery rules", () => {
  it("knows weekdays", () => {
    expect(isoWeekday("2026-11-05")).toBe(4);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });

  it("rejects other zones", () => {
    expect(checkDelivery(policy, "ORL-KIS", "2026-11-07", now, TZ)).toMatchObject({
      ok: false,
      reason: "zone",
    });
  });

  it("rejects non-delivery days with a plain-English reason", () => {
    const r = checkDelivery(policy, "ORL-WP", "2026-11-08", now, TZ);
    expect(r).toMatchObject({ ok: false, reason: "weekday" });
    expect(r.ok ? "" : r.message).toMatch(/Sundays.*Tue, Thu, Sat/);
  });

  it("rejects dates whose cutoff already passed", () => {
    // Today (Thu) needed ordering by Wed noon.
    expect(checkDelivery(policy, "ORL-WP", "2026-11-05", now, TZ)).toMatchObject({
      reason: "cutoff_passed",
    });
  });

  it("accepts Saturday when ordered before Friday noon", () => {
    expect(checkDelivery(policy, "ORL-WP", "2026-11-07", now, TZ)).toEqual({
      ok: true,
      orderBy: { date: "2026-11-06", time: "12:00" },
    });
  });

  it("evaluates the cutoff in Orlando time, not UTC", () => {
    // 11:30 AM Orlando = 16:30 UTC on Friday. Still before the noon cutoff for Saturday.
    const friday = new Date("2026-11-06T16:30:00Z");
    expect(checkDelivery(policy, "ORL-WP", "2026-11-07", friday, TZ).ok).toBe(true);
    const fridayLate = new Date("2026-11-06T17:30:00Z"); // 12:30 PM Orlando
    expect(checkDelivery(policy, "ORL-WP", "2026-11-07", fridayLate, TZ).ok).toBe(false);
  });

  it("lists the next delivery dates", () => {
    expect(nextDeliveryDates(policy, "ORL-WP", now, TZ, 3)).toEqual([
      "2026-11-07",
      "2026-11-10",
      "2026-11-12",
    ]);
  });
});
