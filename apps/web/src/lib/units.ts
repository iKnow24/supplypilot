/**
 * Unit helpers for DISPLAY and input validation in the browser.
 * The optimizer (Python) does the authoritative exact math with fractions;
 * nothing here feeds a purchasing decision.
 */
import type { Unit } from "./catalog/schema";

export class UnitTable {
  private byCode: Map<string, Unit>;
  constructor(units: Unit[]) {
    this.byCode = new Map(units.map((u) => [u.code, u]));
  }

  get(code: string): Unit {
    const u = this.byCode.get(code);
    if (!u) throw new Error(`Unknown unit "${code}"`);
    return u;
  }

  /** Units a product can be ordered in (same base unit, e.g. lb/kg/oz/g for flour). */
  unitsFor(baseUnit: string): Unit[] {
    return [...this.byCode.values()].filter((u) => u.base_unit === baseUnit);
  }

  convert(quantity: number, from: string, to: string): number {
    const a = this.get(from);
    const b = this.get(to);
    if (a.dimension !== b.dimension) {
      throw new Error(`Can't convert ${a.label} to ${b.label}`);
    }
    return (quantity * Number(a.to_base)) / Number(b.to_base);
  }

  /** Price per display unit, e.g. a 50 lb bag at $26.89 -> $0.54 per lb. */
  unitPriceCents(packPriceCents: number, packQty: number, packUnit: string, displayUnit: string) {
    const packInDisplayUnits = this.convert(packQty, packUnit, displayUnit);
    return packPriceCents / packInDisplayUnits;
  }
}

export function formatQuantity(quantity: number, unit: Unit): string {
  const rounded = Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2));
  if (unit.code === "each") return `${rounded.toLocaleString("en-US")}`;
  const label = unit.code === "fl_oz" ? "fl oz" : unit.code;
  return `${rounded.toLocaleString("en-US")} ${label}`;
}

export function unitShortLabel(code: string): string {
  return code === "fl_oz" ? "fl oz" : code;
}
