# MVP scope

**Promise:** "One shopping list. The smartest way to buy it."

## In scope (MVP)

- Buyer picks a fictional bakery, café or restaurant (demo auth).
- Smart Cart: search/add products, edit quantity + unit, load saved weekly list, CSV upload
  with row-level validation, delivery date, supplier/product preferences.
- **Total delivered cost optimizer** (OR-Tools CP-SAT): pack rounding + overbuy, stock,
  minimum order, delivery fee + free-delivery threshold, zones, delivery days + cutoffs,
  explicit volume tiers, buyer-approved equivalences only, stale-data exclusion,
  precise infeasibility explanations.
- Recommendation screen: total, suppliers, line items, fees, minimums, rationale,
  baseline comparison (only when a valid baseline exists), alternatives
  (fewest suppliers, preferred suppliers, lowest item subtotal) with trade-offs labelled.
- Draft purchase orders per supplier, CSV/PDF export, history, duplicate/reorder.
  Status is only ever **Draft** or **Exported**.

## Explicitly out of scope

- Live supplier integrations, scraping, real prices, real orders, payments, supplier messaging.
- Route-aware bundling discounts, automated fulfillment recovery.
- Multi-industry support. Distributor portal.
- Any savings number that isn't measured against the buyer's own baseline.

## Baseline definition

A saved list where each line has a `current_supplier_id` (the buyer's habit). Baseline cost =
the same pricing engine applied to "buy every line from its current supplier on the requested
date", including fees and minimums. If that baseline is infeasible (e.g. current supplier
doesn't deliver that day), we say so and show **no** savings number.

## Demo scenarios (seeded, asserted by optimizer tests in M3)

| # | Scenario | Seed id |
| --- | --- | --- |
| 1 | Cheapest items ≠ cheapest delivered basket | `scn_01_cheap_items_not_cheap_basket` |
| 2 | Bundling with one supplier saves money | `scn_02_bundle_one_supplier` |
| 3 | Stock forces a split across two suppliers | `scn_03_stock_forces_two_suppliers` |
| 4 | Minimum order rules out a cheap supplier | `scn_04_minimum_invalidates_cheap_supplier` |
| 5 | Delivery day changes the answer | `scn_05_delivery_day_changes_answer` |
| 6 | Pack sizes normalized (eggs: 5/15/30 dozen) | `scn_06_pack_size_normalization` |
| 7 | No feasible solution (Sunday) | `scn_07_no_feasible_solution` |
| 8 | Stale price + stale stock flagged | `scn_08_stale_data_flagged` |

The numbers were sanity-checked with a throwaway brute-force script during M1; M3 turns
each into a real test against the optimizer plus a brute-force cross-check.
