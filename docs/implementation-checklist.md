# Implementation checklist

Tick only what works and is tested.

## Milestone 1 — Foundation ✅
- [x] Monorepo: `apps/web`, `services/optimizer`, `data/seed`, `docs`
- [x] Next.js 16 + TS + Tailwind v4 + shadcn-compatible design tokens/components
- [x] FastAPI service skeleton, `/v1/health`, ruff + mypy strict + pytest
- [x] Synthetic catalog: 5 suppliers, 3 buyers, 55 products, 111 offers, 8 scenarios
- [x] Shared contract validated by Pydantic and zod (unknown fields + broken refs rejected)
- [x] Exact unit math (Python, Fractions); display unit math (TS)
- [x] Freshness policy + delivery-date/cutoff logic with tests
- [x] Screens: Home, Smart Cart (load saved list, read-only), Orders (empty), Suppliers + detail, Settings
- [x] Demo buyer switcher (cookie), demo-data banner, responsive nav (bottom tabs on mobile)
- [x] Lint, typecheck, format, unit/component tests, production build, CI workflow

## Milestone 2 — Shopping workflow
- [ ] Persistence decision implemented (Supabase local or SQLite) behind repository interface
- [ ] Cart: product search (keyboard friendly), add/remove, quantity + unit editor with validation
- [ ] Save / duplicate saved lists; favorites
- [ ] CSV upload: template download, parse, per-row errors (unknown product, bad unit, bad qty)
- [ ] Delivery date picker (shows which suppliers can deliver), supplier preferences/exclusions
- [ ] Playwright e2e: load list -> edit -> set date

## Milestone 3 — Optimizer ✅
- [x] `POST /v1/optimize` request/response schemas (Pydantic) + generated OpenAPI + TS types
      (CI checks they're current)
- [x] Offer eligibility (zone, day, cutoff, freshness, stock, mapping review, exclusions,
      approved equivalences) with reasons
- [x] CP-SAT model: integer packs per offer, coverage >= need (exact fractions), stock, min packs,
      all-units tiers, supplier-used booleans, minimums, fee/free-threshold, objective in cents,
      deterministic lexicographic tie-break
- [x] Infeasibility explainer (per line: no eligible offer / not enough stock / only from
      suppliers whose minimum can't be met; per supplier: minimum unreachable)
- [x] Baseline costing (buyer's usual supplier per line; no savings unless it can be priced)
- [x] Alternatives: fewest suppliers, preferred suppliers, lowest item subtotal
- [x] Tests: all 8 scenarios as business assertions + brute-force cross-check on 228 random
      small baskets (60 feasible), eligibility/pricing, API

## Milestone 4 — Recommendations UI
- [ ] Wire "Find My Best Price" via server action; loading/error/infeasible states
- [ ] Hero total, per-supplier breakdown, fees/minimums/overbuy, rationale, alternatives table
- [ ] Optimization run history

## Milestone 5 — Purchase orders
- [ ] Draft POs split by supplier; explicit approve step
- [ ] CSV + PDF export; status Draft/Exported; history; duplicate/reorder

## Milestone 6 — Polish
- [ ] Accessibility pass (axe), keyboard walkthrough, mobile pass
- [ ] Security basics (headers, input limits, RLS tests)
- [ ] Deployment docs (Vercel + Python host + Supabase), demo script
