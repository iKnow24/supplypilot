/**
 * Product search for the cart: every word must match the name, category, spec or id.
 * Name matches rank first (prefix > word start > anywhere), then favorites, then A–Z.
 */
import type { Product } from "../catalog/schema";

function words(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function searchProducts(
  products: Product[],
  query: string,
  favorites: ReadonlySet<string> = new Set(),
  limit = 8,
): Product[] {
  const terms = words(query);
  if (terms.length === 0) return [];
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    const name = words(p.name);
    const rest = words(`${p.category} ${p.spec} ${p.id}`);
    let score = 0;
    let all = true;
    for (const t of terms) {
      if (name[0]?.startsWith(t)) score += 4;
      else if (name.some((w) => w.startsWith(t))) score += 3;
      else if (name.some((w) => w.includes(t))) score += 2;
      else if (rest.some((w) => w.startsWith(t))) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ p, score: score + (favorites.has(p.id) ? 0.5 : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((s) => s.p);
}
