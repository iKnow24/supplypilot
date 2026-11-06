import "server-only";

import { getRepository } from "../catalog/seed-repository";
import { CatalogIndex } from "./validation";

let cached: Promise<{ index: CatalogIndex; supplierIds: Set<string> }> | null = null;

/** Catalog lookups used to validate every cart write. Built once per server process. */
export function catalogContext() {
  cached ??= (async () => {
    const repo = getRepository();
    const [products, units, suppliers] = await Promise.all([
      repo.listProducts(),
      repo.units(),
      repo.listSuppliers(),
    ]);
    return {
      index: new CatalogIndex(products, units),
      supplierIds: new Set(suppliers.map((s) => s.id)),
    };
  })();
  return cached;
}
