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

## Milestone 2 — Shopping workflow ✅
- [x] Persistence: Supabase Postgres (local via `make db-start`) behind `BuyerStateRepository`;
      migrations, RLS per buyer org, demo auth users, generated DB types; RLS integration tests
- [x] Cart: product search (keyboard: `/`, ↑/↓, Enter, Esc), add/remove, quantity + unit editor
      with validation (decimals, whole items for count units, unit must fit the product)
- [x] Save / duplicate / rename / delete saved lists; favorites
- [x] CSV upload: template download, parse, per-row errors (unknown product, bad unit, bad qty,
      duplicates), blank quantity = skip, merge or replace
- [x] Delivery date picker (which suppliers can deliver each day, and why not), supplier
      preferences/exclusions
- [x] Playwright e2e: load list -> edit -> set date (+ CSV, saved lists, tenant isolation); CI job
      runs DB tests and e2e against local Supabase

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

## Milestone 4 — Recommendations UI ✅
- [x] Wire "Find My Best Price" via server action (cart read from Postgres, never the browser);
      loading, error (optimizer down / timeout / rejected), partial and infeasible states
- [x] Hero total, per-supplier breakdown, fees/minimums/overbuy, rationale, alternatives table
- [x] Optimization run history (append-only, RLS per org) + latest verified savings on Home
- [x] Optimizer: partial plans — fill as many lines as possible, explain each one left out
      (brute-force check extended: 400 random baskets, full / partial / infeasible)

## Milestone 5 — Purchase orders ✅
- [x] Draft POs split by supplier; explicit approve step (confirm screen; idempotent per result)
- [x] CSV + PDF export (pdf-lib, multi-page); status Draft/Exported only; exported POs are
      permanent, drafts can be discarded; history on Orders and Home; reorder (one PO or a
      whole result) back into the cart with the PO's supplier as the usual one
- [x] POs are snapshots (names, SKUs, prices, address, cutoff); writes only via validated SQL
      functions; RLS per org (DB tests), CSV formula-injection guard

## Milestone 6 — Polish ✅
- [x] Accessibility: axe WCAG 2.1 AA on all 11 screens (incl. a real result and PO), fixed the
      issues found; keyboard-only walkthrough of the whole flow + focus-ring check; phone pass
      (no sideways scroll, tab bar, total above the fold). All in e2e, run on the production build
- [x] Security: per-request nonce CSP (no unsafe-*, no third-party origins) + static headers;
      optimizer API key (constant-time) and 256 KB body limit; `make db-check` invariants (RLS
      everywhere, nothing for anon, pinned search_path) in CI; locked down function grants
- [x] Deployment: optimizer Dockerfile (non-root, smoke-tested in CI), docs/deployment.md
      (Supabase + Vercel + Fly/Render/Railway, public-demo caveats, before-real-buyers list),
      docs/demo-script.md
