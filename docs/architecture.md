# Architecture

## Shape

```
apps/web/               Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui-style components
  src/app/              Routes: / (landing, (marketing)); the app in (app): /home (+ Autopilot), /stock, /cart, /lists,
                        /results, /orders, /suppliers, /suppliers/[id], /settings
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

- **Catalog: still the seed file.** Suppliers, products, offers, prices and units are read from
  `data/seed/demo_catalog.json` through `CatalogRepository`, the same file the optimizer reads. It
  moves to Postgres only when real distributor catalogs arrive.
- **Buyer state: Postgres (M2).** Carts, cart lines, saved lists, favorites and supplier
  preferences are in Supabase Postgres (`supabase/migrations/`), behind `BuyerStateRepository`
  (`apps/web/src/lib/buyer-state/`). Ids that point into the catalog are text and are validated by
  the server actions on every write.
- **Tenancy is enforced by Postgres.** Every row carries `org_id`; RLS allows it only to members of
  that org (`org_members`); child rows use composite foreign keys `(parent_id, org_id)`, so a line
  can't be attached to another org's cart. Multi-row operations (load list, CSV replace, save as
  list) are `SECURITY INVOKER` SQL functions, so they're atomic and still subject to RLS. Anonymous
  users can read nothing. `apps/web/src/lib/buyer-state/rls.db.test.ts` proves this against a real
  database.
- **Demo auth (still not real sign-in).** One Supabase Auth user per fictional buyer, created by
  `supabase/seed.sql`. With `DEMO_AUTH=on`, `src/proxy.ts` signs a visitor in as the buyer picked in
  the switcher; switching signs out and back in, then does a full page load so no cached page of the
  previous buyer survives. Real sign-in (magic link) replaces this before any real buyer.
- **No database? Say so.** Without Supabase configured, pages render read-only from the seed and show
  why nothing can be saved. We never pretend in-memory data persists.
- **Buyer quotes: Postgres.** Prices a buyer adds from screenshots live in `price_imports` /
  `vendor_prices`, next to (not inside) the seed catalog. See "Vendor prices from screenshots".
- The web app only ever uses the publishable key; the service-role key is not used anywhere.

## Request flow ("Find My Best Price", M4)

```
Browser -> server action findBestPrice()
             reads the cart from Postgres (RLS), checks lines + bookable date
             -> POST {OPTIMIZER_URL}/v1/optimize   (typed: api-types.ts, generated)
             <- optimal | partial | infeasible + alternatives + explanations
             -> insert optimization_runs (request + full response, append-only)
        <- redirect to /results/{run id}, rendered from the stored run
```
- The browser never calls the optimizer and never sends the basket: the server builds the request
  from the database, so a tampered form can't price someone else's cart.
- A run stores the exact response, so a past result reads the same after prices or the cart change.
- Optimizer down, slow (20 s timeout) or rejecting the request -> a plain error toast; nothing is
  stored. Partial and infeasible answers are stored: "why can't I get this?" is worth keeping.

## Purchase orders (M5)

```
/results/{run}  "Approve plan" -> confirm -> approveResult(run)
                   builds one draft per supplier from the STORED result + catalog snapshot
                   -> create_purchase_orders(org, run, drafts)   (SQL, atomic, idempotent)
/orders/{po}    Download PDF/CSV -> exportPurchaseOrder(po) marks Exported (first time kept)
                   -> browser downloads GET /orders/{po}/export?format=pdf|csv (read-only)
                Reorder -> cart replaced with packs x pack size, usual supplier = PO's supplier
```
- Status is only Draft or Exported. Exported POs can't be changed or discarded; drafts can be
  discarded. Lines are never edited: change the cart and run again.
- Buyers can't insert or update POs directly (grants revoked); only the two SQL functions write,
  and they check membership, that the run belongs to the org and has a plan, and that line totals
  add up. Reads and draft deletes are plain RLS.
- SupplyPilot never sends a PO anywhere. Export is the only outbound path.

## Autopilot (Home)

One tap on Home plans the next order. An agent picks the steps; the steps are the same server
code a buyer's own clicks run, so it can't do anything the buyer couldn't.

```
Home "Plan it for me" -> POST /home/autopilot (same-origin, signed in)  streams NDJSON events
   runAgent()  Claude (claude-opus-5-5, tool use, effort low) chooses among five tools:
     check_stock          loadStock(): soonest bookable date, what runs out, how much to order
     draft_order          replaces the Smart Cart with that order (optionally leaving items out)
     check_vendor_quotes  the buyer's screenshot quotes vs the best catalog price (informational)
     price_order          priceCart(): the same Find My Best Price code; saves an optimization run
     present_plan         a headline and up to 3 notes. Ends the run.
   -> autopilot_runs row (plan, notes) -> Home shows the plan card
Plan card "Approve and create N draft POs" -> approveResult() (the existing explicit approve)
```
- **Numbers never come from the AI.** Tools compute and format every figure; the plan card's total,
  savings and suppliers are read back from the stored optimization run. The agent only orders the
  steps, handles exceptions (e.g. leave out an item no supplier can fill, then re-price) and
  writes the notes. It's told the catalog's clock so dates line up with the demo data.
- **It stops before POs.** Creating POs is the buyer's tap; nothing is ever sent to a supplier.
- **No AI? Same steps.** Without `ANTHROPIC_API_KEY`, or past `AUTOPILOT_AI_RUNS_PER_HOUR` (default
  10 per org), or if Claude fails mid-run, a fixed script runs the remaining steps, and the screen
  says so. At most 10 turns and 3 pricings per run.
- `autopilot_runs` is org-scoped with RLS; buyers can start and finish runs, never delete them, and
  a run can only point at its own org's optimization run (composite FK).
- Tests: unit tests drive the loop with a fake Claude and fake tools; e2e uses the mock Messages
  API (`e2e/mock-anthropic.mjs`), which plays a fixed agent (`MOCK_AI_DELAY_MS` slows it down for
  demos).

## Vendor prices from screenshots

Real supplier prices are negotiated, so buyers bring them in: a screenshot or photo of a price
list, invoice, email or text from their rep.

```
/suppliers/import  pick an image (PNG/JPG/WebP; phone photos are shrunk in the browser)
                   -> readPriceScreenshot()   server action: checks size + magic bytes, caps reads per
                      org per hour (price_reads), sends the image to Claude (claude-opus-5-5,
                      structured output) with the catalog's product list, returns a DRAFT. The image
                      is never stored.
                   -> normalize.ts            deterministic: catalog units, per-unit prices multiplied
                      out to a pack in exact integer cents, product suggestions, anything unread or
                      unmatched flagged "Unclear"
                   review: every line editable, mapped to a catalog product, approved or rejected
                   -> savePriceImport()       re-validates every line, save_price_import() (atomic)
```
- AI only transcribes (rule 1 above). A person reviews every line before it is saved; unmatched
  products can't be approved.
- Stored in `price_imports` (vendor, optional catalog supplier, document kind and date) and
  `vendor_prices` (product, pack, pack price, AI confidence, `mapping_method` `ai_suggested` or
  `manual`). Org-scoped RLS like the rest; no updates; deleting an import deletes its prices.
- Shown as "Your quote" on the item page's cheapest-vendor list and the supplier page: per
  vendor, the latest quote, dated by the document (else the upload day). Quote age uses the real
  calendar and the same 14-day rule as catalog prices.
- **Not used by the optimizer yet.** Feeding quotes into Find My Best Price changes the
  optimizer contract (`api-contract.md`), so it waits for both founders to agree.
- Tests never call the AI: unit tests inject a fake client; e2e points `ANTHROPIC_BASE_URL` at
  `apps/web/e2e/mock-anthropic.mjs`.

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
Since M2 (Postgres): User (Supabase Auth), org membership, Cart/CartLine, saved lists, favorites.
Later milestones: OptimizationRun/Recommendation/RecommendationLine
(M3-4), PurchaseOrder/PurchaseOrderLine/ExportArtifact (M5).

Supplier-facing features (a distributor portal) will live in their own route group and
repository methods; nothing buyer-facing depends on them.
