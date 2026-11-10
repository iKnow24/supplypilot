import { unitShortLabel } from "../units";
import type { StockStatus } from "./plan";

export const STATUS: Record<
  StockStatus,
  { label: string; variant: "destructive" | "warning" | "success" | "neutral"; text: string }
> = {
  short: { label: "Runs out first", variant: "destructive", text: "text-destructive" },
  order: { label: "Order", variant: "warning", text: "text-warning" },
  ok: { label: "Enough", variant: "success", text: "text-success" },
  unknown: { label: "Needs a count", variant: "neutral", text: "text-muted-foreground" },
};

/** "4.3 lb", "250" (each), "7.6 gal". */
export function qty(n: number, unit: string) {
  const v = unit === "each" ? Math.round(n) : Math.round(n * 10) / 10;
  const label = unit === "each" ? "" : ` ${unitShortLabel(unit)}`;
  return `${v.toLocaleString("en-US")}${label}`;
}

/** "3 days left", "Under a day", "Out". */
export function daysLeftText(daysLeft: number | null, onHand: number | null): string {
  if (daysLeft === null) return onHand === null ? "Not counted" : "Not used lately";
  if (onHand !== null && onHand <= 0) return "Out";
  if (daysLeft < 1) return "Under a day";
  const d = Math.floor(daysLeft);
  return `${d} day${d === 1 ? "" : "s"} left`;
}
