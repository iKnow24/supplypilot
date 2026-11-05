/** Small view-model helpers shared by server pages. */
import type { SavedList } from "./catalog/schema";
import type { SupplierSummary } from "./catalog/repository";

export function greeting(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Distinct suppliers a saved list currently buys from (the buyer's baseline habit). */
export function baselineSuppliers(list: SavedList, suppliers: SupplierSummary[]) {
  const ids = [...new Set(list.lines.map((l) => l.current_supplier_id).filter(Boolean))];
  return ids.map((id) => suppliers.find((s) => s.id === id)?.short_name ?? id);
}
