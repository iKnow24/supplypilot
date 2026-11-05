/**
 * CatalogRepository backed by the synthetic seed file.
 *
 * Server-only: buyer-specific prices must never be bundled into browser
 * JavaScript, so this module refuses to load in a client component.
 * Nothing here persists: it is read-only demo data. Persistent carts and
 * orders arrive with the Supabase repository (see docs/architecture.md).
 */
import "server-only";

// One shared catalog file for the web app and the optimizer service.
import seedCatalog from "../../../../../data/seed/demo_catalog.json";
import { assessFreshness } from "../freshness";
import type {
  BuyerOffer,
  BuyerSummary,
  CatalogRepository,
  DataSourceInfo,
  SupplierSummary,
} from "./repository";
import { catalogSchema, type BuyerRecord, type Catalog } from "./schema";

export function parseCatalog(raw: unknown): Catalog {
  return catalogSchema.parse(raw);
}

function toSummary(b: BuyerRecord): BuyerSummary {
  // Deliberately drops contract_prices: summaries are safe to show anywhere.
  return { id: b.id, name: b.name, kind: b.kind, synthetic: b.synthetic, locations: b.locations };
}

export class SeedCatalogRepository implements CatalogRepository {
  constructor(private readonly catalog: Catalog) {}

  /** Validates the bundled seed file. Throws (and the app shows an error) if it is malformed. */
  static fromSeed(raw: unknown = seedCatalog): SeedCatalogRepository {
    return new SeedCatalogRepository(parseCatalog(raw));
  }

  private info(): DataSourceInfo {
    const m = this.catalog.meta;
    return {
      dataset: m.dataset,
      synthetic: m.synthetic,
      label: m.label,
      currency: m.currency,
      timezone: m.timezone,
      market: m.market,
      // Synthetic data uses its fixed demo clock; real data would use the real clock.
      now: m.synthetic ? new Date(m.reference_now) : new Date(),
      priceMaxAgeHours: m.freshness_policy.price_max_age_hours,
      inventoryMaxAgeHours: m.freshness_policy.inventory_max_age_hours,
    };
  }

  async source() {
    return this.info();
  }

  async units() {
    return this.catalog.units;
  }

  async zones() {
    return this.catalog.zones;
  }

  async listBuyers() {
    return this.catalog.buyers.map(toSummary);
  }

  async getBuyer(buyerId: string) {
    const b = this.catalog.buyers.find((x) => x.id === buyerId);
    return b ? toSummary(b) : null;
  }

  async listSavedLists(buyerId: string) {
    return this.catalog.buyers.find((b) => b.id === buyerId)?.saved_lists ?? [];
  }

  async listProducts() {
    return this.catalog.products;
  }

  private summarize(supplierId: string): SupplierSummary | null {
    const s = this.catalog.suppliers.find((x) => x.id === supplierId);
    if (!s) return null;
    const info = this.info();
    const offers = this.catalog.offers.filter((o) => o.supplier_id === supplierId);
    const max = (dates: (string | undefined)[]) => {
      const ts = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
      return ts.length ? new Date(Math.max(...ts)) : null;
    };
    const flagged = offers.filter(
      (o) =>
        !assessFreshness({
          now: info.now,
          priceUpdatedAt: new Date(o.price_updated_at),
          inventoryAsOf: o.inventory ? new Date(o.inventory.as_of) : null,
          priceMaxAgeHours: info.priceMaxAgeHours,
          inventoryMaxAgeHours: info.inventoryMaxAgeHours,
        }).ok,
    ).length;
    return {
      ...s,
      offerCount: offers.length,
      servesZone: (zone: string) => s.policy.zones.includes(zone),
      latestPriceUpdate: max(offers.map((o) => o.price_updated_at)),
      latestInventorySnapshot: max(offers.map((o) => o.inventory?.as_of)),
      flaggedOfferCount: flagged,
    };
  }

  async listSuppliers() {
    return this.catalog.suppliers.map((s) => this.summarize(s.id)!);
  }

  async getSupplier(supplierId: string) {
    return this.summarize(supplierId);
  }

  async listOffersForBuyer(buyerId: string, filter: { supplierId?: string } = {}) {
    const buyer = this.catalog.buyers.find((b) => b.id === buyerId);
    if (!buyer) throw new Error(`Unknown buyer ${buyerId}`);
    const info = this.info();
    const products = new Map(this.catalog.products.map((p) => [p.id, p]));
    const contract = new Map(
      buyer.contract_prices.map((c) => [`${c.supplier_id}|${c.product_id}`, c.price_cents]),
    );
    return this.catalog.offers
      .filter((o) => !filter.supplierId || o.supplier_id === filter.supplierId)
      .map((o): BuyerOffer => {
        const contractPrice = contract.get(`${o.supplier_id}|${o.product_id}`);
        const priceUpdatedAt = new Date(o.price_updated_at);
        const inventory = o.inventory
          ? { packsAvailable: o.inventory.packs_available, asOf: new Date(o.inventory.as_of) }
          : null;
        return {
          id: o.id,
          supplierId: o.supplier_id,
          product: products.get(o.product_id)!,
          supplierSku: o.supplier_sku,
          pack: o.pack,
          priceCents: contractPrice ?? o.list_price_cents,
          priceBasis: contractPrice === undefined ? "list" : "contract",
          minPacks: o.min_packs,
          priceTiers: o.price_tiers,
          priceUpdatedAt,
          inventory,
          freshness: assessFreshness({
            now: info.now,
            priceUpdatedAt,
            inventoryAsOf: inventory?.asOf ?? null,
            priceMaxAgeHours: info.priceMaxAgeHours,
            inventoryMaxAgeHours: info.inventoryMaxAgeHours,
          }),
          source: { type: o.source.type, importId: o.source.import_id },
          synthetic: o.synthetic,
        };
      });
  }
}

let singleton: SeedCatalogRepository | null = null;

/** The repository pages use. Swap the implementation here, nowhere else. */
export function getRepository(): CatalogRepository {
  singleton ??= SeedCatalogRepository.fromSeed();
  return singleton;
}
