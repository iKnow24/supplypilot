# Architecture

## Shape

```
apps/web/               Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui-style components
  src/app/              Routes: / (Home), /cart, /orders, /suppliers, /suppliers/[id], /settings
  src/lib/catalog/      CatalogRepository interface + SeedCatalogRepository (server-only)
  src/lib/              units, delivery dates, freshness policy, money formatting
services/optimizer/     Python FastAPI service. Owns ALL pricing math and (M3) the CP-SAT optimizer
  src/supplypilot_optimizer/catalog.py   Pydantic contract for the catalog
  src/supplypilot_optimizer/units.py     Exact unit math with Fractions
  src/supplypilot_optimizer/api.py       /v1/* HTTP endpoints
data/seed/              generate_seed.py -> demo_catalog.json (the one shared synthetic dataset)
docs/                   This folder
```

## The rules that shape everything

1. **Numbers come from deterministic code, never from an LLM.** Prices, quantities, fees,
   feasibility and the recommendation are computed by the Python service. AI may later help
   parse a messy order list or word an explanation; it never decides.
2. **Integer cents, exact quantities.** Money is `int` cents. Quantities are decimal strings
   converted to `Fraction`s, so "50 lb" vs "25 kg" never drifts. The browser only does
   display-grade math.
3. **One catalog contract, validated on both sides.** `data/seed/demo_catalog.json` is parsed by
   Pydantic (Python) and zod (TypeScript). Both reject unknown fields and broken references,
   so contract drift breaks a test instead of the demo. See `api-contract.md`.
4. **Tenant isolation is in the interface.** Every buyer-facing price call takes a `buyerId` and
   returns only that buyer's contract price. Buyer summaries never carry prices. The seed
   repository is `server-only`, so negotiated prices are never shipped to the browser bundle.
5. **Never invent data.** Stale or missing data is flagged and excluded (policy below). Savings
   are only shown against a defined baseline. Fictional businesses carry "(Demo)" in their name.
6. **Integrate, don't replace.** Every offer records `source` (`synthetic_seed`, later
   `csv_import`, `api`, `edi`, `email`) plus an import id, and `mapping.method`
   (`supplier_provided` | `manual` | `ai_suggested`). AI-suggested mappings are untrusted until
   a person reviews them.

## Data freshness policy

Measured against "now". For synthetic data "now" is the dataset's fixed demo clock
(`meta.reference_now`, Thu 2026-11-05 09:00 Orlando) so demos and tests behave the same any day.

| Condition | Threshold | Treatment |
| --- | --- | --- |
| Price age | > 14 days | Excluded from optimization, flagged "Price out of date" |
| Stock snapshot age | > 36 hours | Excluded, flagged "Stock count out of date" |
| No stock snapshot | — | Excluded, flagged "No stock count" |

## Delivery feasibility

A supplier can deliver on local date D to zone Z if Z is in its zones, D's weekday is a
delivery day, and "now" (in `America/New_York`) is before `D - lead_days` at the cutoff time.
Implemented in `apps/web/src/lib/delivery.ts` for display; the optimizer re-implements it
authoritatively in Python in M3 (with the same test cases).

## Persistence and auth (honest status)

- **M1: no persistence.** The seed repository is read-only. Nothing a user does is saved.
- **Demo auth:** a cookie picks one of three fictional buyers. It is not security.
- **Plan:** Supabase Postgres with migrations + RLS keyed on buyer organization, and Supabase
  Auth. A `SupabaseCatalogRepository` implements the same `CatalogRepository` interface, so
  pages don't change. For carts/orders a local fallback (SQLite or local Postgres via
  `supabase start`) will be documented; we will not silently pretend in-memory data persists.

## Request flow (from M3/M4)

```
Browser -> Next.js server action -> POST {OPTIMIZER_URL}/v1/optimize (typed JSON)
                                  <- recommendation + alternatives + line-level explanations
```
The browser never calls the optimizer directly, and never sees other buyers' prices.

## Extension points (designed, not built)

- **Delivery-aware bundling (B):** `DeliveryPolicy` is per supplier today. Route schedules,
  capacity and stop density would extend it with authorized data. No route discounts are claimed.
- **Fulfillment recovery (C):** stockout -> re-run the optimizer with that offer removed and
  approved equivalences enabled -> show the cost delta -> human approves. MVP only has the
  synthetic stockout/infeasible scenarios.
- **Integrations (D):** catalog adapters (CSV first) write offers with `source` metadata.
  PO export (CSV/PDF) is the only outbound path in MVP.

## Domain model (entities from the spec)

Implemented now (in the seed contract): BuyerOrganization, BuyerLocation, Supplier,
SupplierDeliveryPolicy, Product, ProductEquivalence, SupplierOffer (with pack = variant),
InventorySnapshot, CatalogImport, saved lists (Cart templates).
Later milestones: User, Cart/CartLine (M2), OptimizationRun/Recommendation/RecommendationLine
(M3-4), PurchaseOrder/PurchaseOrderLine/ExportArtifact (M5).

Supplier-facing features (a distributor portal) will live in their own route group and
repository methods; nothing buyer-facing depends on them.
