/**
 * The data-access contract the UI depends on.
 *
 * Today the only implementation is SeedCatalogRepository (reads the synthetic
 * JSON catalog). Later a SupabaseCatalogRepository implements the SAME
 * interface, so pages do not change when real persistence arrives.
 *
 * Tenant isolation is part of the contract: every buyer-facing price method
 * takes a buyerId and returns only that buyer's price. No method returns
 * another buyer's negotiated prices.
 */
import type { DeliveryPolicy, Product, SavedList, Supplier, Unit } from "./schema";
import type { FreshnessStatus } from "../freshness";

export interface DataSourceInfo {
  dataset: string;
  synthetic: boolean;
  label: string;
  currency: "USD";
  timezone: string;
  market: string;
  /** The instant freshness is measured against. Fixed for synthetic data. */
  now: Date;
  priceMaxAgeHours: number;
  inventoryMaxAgeHours: number;
}

export interface BuyerSummary {
  id: string;
  name: string;
  kind: "bakery" | "cafe" | "restaurant";
  synthetic: boolean;
  locations: { id: string; name: string; zone: string; address_label: string }[];
}

/** A supplier offer as ONE buyer is allowed to see it. */
export interface BuyerOffer {
  id: string;
  supplierId: string;
  product: Product;
  supplierSku: string;
  pack: { quantity: string; unit: string; label: string };
  /** The price this buyer pays per pack, before any volume tier. */
  priceCents: number;
  priceBasis: "contract" | "list";
  minPacks: number;
  priceTiers: { min_packs: number; price_cents: number }[];
  priceUpdatedAt: Date;
  inventory: { packsAvailable: number; asOf: Date } | null;
  freshness: FreshnessStatus;
  source: { type: string; importId: string };
  synthetic: boolean;
}

export interface SupplierSummary extends Supplier {
  offerCount: number;
  servesZone: (zone: string) => boolean;
  latestPriceUpdate: Date | null;
  latestInventorySnapshot: Date | null;
  flaggedOfferCount: number;
}

export interface CatalogRepository {
  source(): Promise<DataSourceInfo>;
  units(): Promise<Unit[]>;
  zones(): Promise<{ id: string; name: string }[]>;
  listBuyers(): Promise<BuyerSummary[]>;
  getBuyer(buyerId: string): Promise<BuyerSummary | null>;
  listSavedLists(buyerId: string): Promise<SavedList[]>;
  listProducts(): Promise<Product[]>;
  listSuppliers(): Promise<SupplierSummary[]>;
  getSupplier(supplierId: string): Promise<SupplierSummary | null>;
  listOffersForBuyer(buyerId: string, filter?: { supplierId?: string }): Promise<BuyerOffer[]>;
}

export type { DeliveryPolicy, Product, SavedList, Supplier, Unit };
