/**
 * Deterministic suggestions for the review screen: which catalog products a printed line might
 * be, and which catalog supplier a vendor name is. The buyer always has the final say.
 */
import type { Product, Supplier } from "../catalog/schema";

const STOP = new Set([
  "a", "an", "and", "the", "of", "with", "for", "per", "in", "case", "cs", "bag", "box", "pack",
  "pk", "ct", "count", "each", "ea", "lb", "lbs", "oz", "kg", "g", "gal", "qt", "pt", "l", "ml",
  "dozen", "dz", "doz", "fl", "x", "demo",
]); // prettier-ignore

/** Common shorthand on invoices and price sheets. */
const ALIASES: Record<string, string> = {
  ap: "all purpose",
  evoo: "olive",
  hvy: "heavy",
  lg: "large",
  unbl: "unbleached",
  gran: "granulated",
  choc: "chocolate",
  conf: "powdered",
  confectioners: "powdered",
  mozz: "mozzarella",
  parm: "parmesan",
  hh: "half",
};

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .flatMap((t) => (ALIASES[t] ?? t).split(" "))
    .map((t) => t.replace(/ies$/, "y").replace(/(?<=[a-z]{3})(es|s)$/, ""))
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d/.test(t));
}

/** Best catalog products for a printed line, best first. Name words count more than spec words. */
export function suggestProducts(description: string, products: Product[], limit = 3): string[] {
  const words = new Set(tokens(description));
  if (words.size === 0) return [];
  return products
    .map((p) => {
      const name = new Set(tokens(p.name));
      const spec = new Set(tokens(p.spec));
      let score = 0;
      for (const w of words) {
        if (name.has(w)) score += 2;
        else if (spec.has(w)) score += 1;
      }
      // Prefer products whose name is mostly covered by the line.
      const coverage = name.size ? [...name].filter((w) => words.has(w)).length / name.size : 0;
      return { id: p.id, score: score + coverage };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((s) => s.id);
}

function bare(name: string) {
  return name
    .toLowerCase()
    .replace(/\(demo\)/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The catalog supplier a vendor name refers to ("Bramblewood Baking" -> sup_bramblewood). */
export function matchSupplier(
  vendorName: string,
  suppliers: Pick<Supplier, "id" | "name" | "short_name">[],
): string | null {
  const v = bare(vendorName);
  if (!v) return null;
  const hit = suppliers.find((s) => {
    const short = bare(s.short_name);
    return v === bare(s.name) || (short.length >= 4 && ` ${v} `.includes(` ${short} `));
  });
  return hit?.id ?? null;
}
