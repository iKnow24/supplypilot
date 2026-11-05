/**
 * Delivery-date math using a supplier's published (here: synthetic) schedule.
 * All comparisons happen in the market's local time zone, so 2 PM cutoff means
 * 2 PM in Orlando no matter where the server runs.
 */
import type { DeliveryPolicy } from "./catalog/schema";

export const WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Local calendar parts of an instant in a time zone. */
export function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Pure calendar arithmetic on YYYY-MM-DD strings (no time zones involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

export type DeliveryCheck =
  | { ok: true; orderBy: { date: string; time: string } }
  | { ok: false; reason: "zone" | "weekday" | "cutoff_passed"; message: string };

/** Can this supplier deliver to `zone` on local date `date`, ordering at `now`? */
export function checkDelivery(
  policy: DeliveryPolicy,
  zone: string,
  date: string,
  now: Date,
  timeZone: string,
): DeliveryCheck {
  if (!policy.zones.includes(zone)) {
    return { ok: false, reason: "zone", message: "Does not deliver to your area" };
  }
  const weekday = isoWeekday(date);
  if (!policy.delivery_weekdays.includes(weekday)) {
    const days = policy.delivery_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ");
    return {
      ok: false,
      reason: "weekday",
      message: `Doesn't deliver on ${WEEKDAY_LONG[weekday]}s (delivers ${days})`,
    };
  }
  const orderBy = { date: addDays(date, -policy.lead_days), time: policy.cutoff_local_time };
  const local = localParts(now, timeZone);
  if (`${local.date} ${local.time}` > `${orderBy.date} ${orderBy.time}`) {
    return { ok: false, reason: "cutoff_passed", message: "Order cutoff has passed" };
  }
  return { ok: true, orderBy };
}

/** The next `count` dates this supplier can still deliver to `zone`. */
export function nextDeliveryDates(
  policy: DeliveryPolicy,
  zone: string,
  now: Date,
  timeZone: string,
  count = 3,
): string[] {
  const out: string[] = [];
  const today = localParts(now, timeZone).date;
  for (let i = 0; i < 21 && out.length < count; i++) {
    const date = addDays(today, i);
    if (checkDelivery(policy, zone, date, now, timeZone).ok) out.push(date);
  }
  return out;
}

export function formatDate(date: string, style: "short" | "long" = "short"): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    month: "short",
    day: "numeric",
  });
}
