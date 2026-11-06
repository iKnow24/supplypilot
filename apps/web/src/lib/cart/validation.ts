/**
 * Cart-line validation shared by the browser (instant feedback) and server actions
 * (authoritative: never trust what the browser sends).
 *
 * Quantities stay decimal STRINGS end to end, like the catalog contract, so nothing here
 * rounds a buyer's number through floating point.
 */
import type { Product, Unit } from "../catalog/schema";

export const MAX_QUANTITY = 100_000;
export const MAX_DECIMALS = 3;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** "  12.50 " -> "12.5"; "1,200" -> "1200". Rejects zero, negatives, text, >3 decimals. */
export function parseQuantity(input: string): Result<string> {
  const raw = input.trim().replace(/,(?=\d{3}(\D|$))/g, "");
  if (raw === "") return { ok: false, error: "Enter a quantity" };
  if (!/^\d*\.?\d+$|^\d+\.$/.test(raw)) return { ok: false, error: "Use a number like 12 or 2.5" };
  const [whole = "", frac = ""] = raw.split(".");
  if (frac.length > MAX_DECIMALS) {
    return { ok: false, error: `Use at most ${MAX_DECIMALS} decimal places` };
  }
  const trimmedFrac = frac.replace(/0+$/, "");
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const value = trimmedFrac ? `${trimmedWhole}.${trimmedFrac}` : trimmedWhole;
  const n = Number(value);
  if (n <= 0) return { ok: false, error: "Quantity must be more than 0" };
  if (n > MAX_QUANTITY) {
    return { ok: false, error: `That's more than ${MAX_QUANTITY.toLocaleString("en-US")}` };
  }
  return { ok: true, value };
}

export class CatalogIndex {
  readonly products: Map<string, Product>;
  readonly units: Map<string, Unit>;
  private byName: Map<string, Product>;

  constructor(products: Product[], units: Unit[]) {
    this.products = new Map(products.map((p) => [p.id, p]));
    this.units = new Map(units.map((u) => [u.code, u]));
    this.byName = new Map(products.map((p) => [normalize(p.name), p]));
  }

  /** Accepts a product id or its exact name (case/spacing-insensitive). */
  findProduct(idOrName: string): Product | undefined {
    const key = idOrName.trim();
    return this.products.get(key) ?? this.byName.get(normalize(key));
  }

  /** Accepts a unit code or label: "lb", "pound", "fl oz", "Dozen". */
  findUnit(codeOrLabel: string): Unit | undefined {
    const key = normalize(codeOrLabel).replace(/ /g, "_");
    if (this.units.has(key)) return this.units.get(key);
    const singular = key.replace(/s$/, "");
    return [...this.units.values()].find(
      (u) => normalize(u.label).replace(/ /g, "_") === singular || u.code === singular,
    );
  }

  unitsFor(product: Product): Unit[] {
    return [...this.units.values()].filter((u) => u.base_unit === product.base_unit);
  }
}

function plural(label: string) {
  return label === "each" ? "items" : `${label}s`;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Checks one quantity + unit for one product. */
export function validateAmount(
  index: CatalogIndex,
  product: Product,
  quantityInput: string,
  unitInput: string,
): Result<{ quantity: string; unit: string }> {
  const unit = index.findUnit(unitInput);
  if (!unit) return { ok: false, error: `Unknown unit "${unitInput.trim()}"` };
  if (unit.base_unit !== product.base_unit) {
    const allowed = index
      .unitsFor(product)
      .map((u) => u.code.replace("_", " "))
      .join(", ");
    return {
      ok: false,
      error: `${product.name} can't be measured in ${plural(unit.label)} (use ${allowed})`,
    };
  }
  const q = parseQuantity(quantityInput);
  if (!q.ok) return q;
  if (unit.dimension === "count" && !isWhole(q.value, unit.to_base)) {
    return { ok: false, error: `Use whole items (${q.value} ${unit.code} isn't a whole number)` };
  }
  return { ok: true, value: { quantity: q.value, unit: unit.code } };
}

/** quantity * to_base is an integer, checked exactly with scaled integers. */
function isWhole(quantity: string, toBase: string): boolean {
  const scale = (s: string) => {
    const [w, f = ""] = s.split(".");
    return { n: BigInt(w + f), d: BigInt(10) ** BigInt(f.length) };
  };
  const a = scale(quantity);
  const b = scale(toBase);
  return (a.n * b.n) % (a.d * b.d) === BigInt(0);
}

export interface CartLineInput {
  product_id: string;
  quantity: string;
  unit: string;
  current_supplier_id: string | null;
}

/** Validates a full line coming from the browser. Supplier ids must exist in the catalog. */
export function validateLine(
  index: CatalogIndex,
  supplierIds: Set<string>,
  line: { product_id: string; quantity: string; unit: string; current_supplier_id?: string | null },
): Result<CartLineInput> {
  const product = index.products.get(line.product_id);
  if (!product) return { ok: false, error: "Unknown product" };
  const amount = validateAmount(index, product, line.quantity, line.unit);
  if (!amount.ok) return amount;
  const supplier = line.current_supplier_id ?? null;
  if (supplier !== null && !supplierIds.has(supplier)) {
    return { ok: false, error: "Unknown supplier" };
  }
  return {
    ok: true,
    value: { product_id: product.id, ...amount.value, current_supplier_id: supplier },
  };
}

export function validateListName(input: string): Result<string> {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Give the list a name" };
  if (name.length > 80) return { ok: false, error: "Keep the name under 80 characters" };
  return { ok: true, value: name };
}
