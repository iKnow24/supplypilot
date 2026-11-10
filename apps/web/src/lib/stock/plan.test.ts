import { describe, expect, it } from "vitest";

import { BUFFER_DAYS, COVER_DAYS, daysBetween, planLine, planStock, type StockInput } from "./plan";

const TZ = "America/New_York";
// Thursday Nov 5 2026, 9:00 AM Orlando
const now = new Date("2026-11-05T09:00:00-05:00");
const opts = { now, timeZone: TZ, deliveryDate: "2026-11-06" }; // Friday: 1 day away

const item = (over: Partial<StockInput> = {}): StockInput => ({
  productId: "prd_flour",
  unit: "lb",
  count: { quantity: 70, countedAt: now },
  weeklyUsage: [70, 70, 70, 70],
  ...over,
});

describe("planLine", () => {
  it("uses the average of the last 4 weeks as the burn rate", () => {
    const line = planLine(item({ weeklyUsage: [999, 999, 60, 70, 80, 70] }), opts);
    expect(line.weekly).toBe(70);
  });

  it("orders enough to reach the delivery, cover a week, and keep a buffer", () => {
    // 10 lb/day; 1 day to delivery + 7 cover + 2 buffer = 100 lb needed, 70 on hand.
    const line = planLine(item(), opts);
    expect(1 + COVER_DAYS + BUFFER_DAYS).toBe(10);
    expect(line.suggested).toBe(30);
    expect(line.atDelivery).toBe(60);
    expect(line.status).toBe("order");
    expect(line.runsOutOn).toBe("2026-11-12");
    expect(line.daysLeft).toBe(7);
  });

  it("subtracts what was used since the count", () => {
    const counted = new Date(now.getTime() - 2 * 86_400_000); // two days ago
    const line = planLine(item({ count: { quantity: 70, countedAt: counted } }), opts);
    expect(line.onHand).toBeCloseTo(50);
    expect(line.suggested).toBe(50);
  });

  it("flags items that run out before the delivery arrives", () => {
    const line = planLine(
      item({ count: { quantity: 5, countedAt: now } }),
      { ...opts, deliveryDate: "2026-11-07" }, // 2 days away: 20 lb used before it arrives
    );
    expect(line.status).toBe("short");
    expect(line.atDelivery).toBe(-15);
    expect(line.suggested).toBe(105);
  });

  it("skips items with enough on hand", () => {
    const line = planLine(item({ count: { quantity: 100, countedAt: now } }), opts);
    expect(line.suggested).toBe(0);
    expect(line.status).toBe("ok");
  });

  it("rounds up to a whole unit, but never orders for float noise", () => {
    const line = planLine(item({ weeklyUsage: [7.7, 7.7, 7.7, 7.7] }), opts);
    // 1.1/day * 10 days = 11 needed, 70 on hand: nothing to order
    expect(line.suggested).toBe(0);
    const tight = planLine(
      item({ count: { quantity: 10.5, countedAt: now }, weeklyUsage: [7.7, 7.7, 7.7, 7.7] }),
      opts,
    );
    expect(tight.suggested).toBe(1); // 0.5 short, rounded up
  });

  it("reports a trend when there are 8 weeks of history", () => {
    const line = planLine(item({ weeklyUsage: [50, 50, 50, 50, 60, 60, 60, 60] }), opts);
    expect(line.trend).toBeCloseTo(0.2);
    expect(planLine(item(), opts).trend).toBeNull();
  });

  it("can't plan an item that was never counted or has no history", () => {
    expect(planLine(item({ count: null }), opts).status).toBe("unknown");
    expect(planLine(item({ weeklyUsage: [] }), opts).status).toBe("unknown");
    expect(planLine(item({ count: null }), opts).suggested).toBe(0);
  });

  it("never estimates negative stock, even long after a count", () => {
    const old = new Date(now.getTime() - 30 * 86_400_000);
    const line = planLine(item({ count: { quantity: 70, countedAt: old } }), opts);
    expect(line.onHand).toBe(0);
    expect(line.status).toBe("short");
  });

  it("treats a count recorded after 'now' as current", () => {
    const later = new Date(now.getTime() + 86_400_000);
    expect(planLine(item({ count: { quantity: 70, countedAt: later } }), opts).onHand).toBe(70);
  });
});

describe("planStock", () => {
  it("lists the most urgent items first", () => {
    const lines = planStock(
      [
        item({ productId: "ok", count: { quantity: 500, countedAt: now } }),
        item({ productId: "order" }),
        item({ productId: "unknown", count: null }),
        item({ productId: "short", count: { quantity: 1, countedAt: now } }),
      ],
      { ...opts, deliveryDate: "2026-11-07" },
    );
    expect(lines.map((l) => l.productId)).toEqual(["short", "order", "unknown", "ok"]);
  });
});

it("daysBetween counts calendar days", () => {
  expect(daysBetween("2026-11-05", "2026-11-06")).toBe(1);
  expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2); // across the DST change
});
