/** Small view-model helpers shared by server pages. */
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
export function baselineSuppliers(
  list: { lines: { current_supplier_id: string | null }[] },
  suppliers: SupplierSummary[],
) {
  const ids = [
    ...new Set(list.lines.flatMap((l) => (l.current_supplier_id ? [l.current_supplier_id] : []))),
  ];
  return ids.map((id): string => suppliers.find((s) => s.id === id)?.short_name ?? id);
}
