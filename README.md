# SupplyPilot

**One shopping list. The smartest way to buy it.**

A buyer-first purchasing tool for independent bakeries, cafés and restaurants. The buyer builds
one list; SupplyPilot finds the lowest *total delivered* cost across participating
distributors (prices, packs, stock, fees, minimums, delivery days) and explains why.

**Live demo:** https://supplypilot-nu.vercel.app (pick a fictional business in the header; the
[demo script](docs/demo-script.md) walks through it).

> ⚠️ **Everything in this repo runs on synthetic demo data.** Every supplier and buyer is
> fictional and labelled "(Demo)". No live prices, no live stock, no real orders.

## Status

Milestones 1–5 are done: foundation, shopping workflow (persistent cart, saved lists, CSV upload,
delivery date, supplier preferences), the CP-SAT optimizer (`POST /v1/optimize`), the
recommendations UI ("Find My Best Price", results, alternatives, history), and purchase orders
(approve, draft POs per supplier, CSV/PDF export, reorder). M6 added the accessibility,
security and deployment pass. See [`docs/implementation-checklist.md`](docs/implementation-checklist.md),
the [demo script](docs/demo-script.md) and [how to deploy](docs/deployment.md).

## Run it locally

Prereqs: **Node 22+**, **[uv](https://docs.astral.sh/uv/)** (`brew install uv`), Python 3.11+
(uv will fetch one if needed), `make`.

```bash
make setup      # npm install + uv sync
make dev        # web on http://localhost:3000, optimizer on http://127.0.0.1:8000/docs
```

Or in two terminals:

```bash
cd apps/web && npm run dev
cd services/optimizer && uv run supplypilot-optimizer
```

The web app calls the optimizer server-to-server at `OPTIMIZER_URL` (default
`http://127.0.0.1:8000`). Browsing works without it; "Find My Best Price" says plainly when it
isn't reachable.

### Local database (Milestone 2+)

Carts, saved lists, favorites and supplier preferences live in Postgres (Supabase) with row level
security per buyer. Without it the app still runs read-only and says so on every page that would
save something.

Prereq: a Docker engine. On macOS use [OrbStack](https://orbstack.dev) (`brew install --cask orbstack`,
then open it once). The Supabase CLI is pinned as a devDependency of `apps/web`, so `make setup`
installs it; no Homebrew formula needed.

```bash
make db-start   # Postgres :54322, API :54321, Mailpit :54324; writes apps/web/.env.local
make web        # http://localhost:3000, signed in automatically as the selected demo buyer
make db-reset   # wipe and re-apply supabase/migrations + supabase/seed.sql
make db-stop
```

- **Demo sign-in.** Each fictional buyer has a demo account (`demo.<name>@supplypilot.test`,
  password in `supabase/generate_seed_sql.py`; local test values for fictional users). With
  `DEMO_AUTH=on` (written by `make db-env`) the app signs in as the buyer picked in the switcher, so
  Postgres RLS is enforced for real. Never seed these accounts into a hosted project with real users.
- **Schema changes:** add a file under `supabase/migrations/`, run `make db-reset`, then
  `make db-types` to regenerate `apps/web/src/lib/db/database.types.ts`. CI fails if either the seed
  or the types are stale.
- **Seed changes:** `supabase/seed.sql` is generated from `data/seed/demo_catalog.json` by
  `python3 supabase/generate_seed_sql.py` (`make db-reset` runs it for you).
- To keep the download small (~2 GB), `supabase/config.toml` turns off Studio, Storage, Realtime,
  Edge Functions and Analytics. Flip `enabled = true` under any of them if you need it. The keys
  `make db-status` prints are the well-known local-only demo keys, not secrets.

**Troubleshooting: "Your sign-in expired and couldn't be renewed".** After a Mac sleeps, the Docker
VM's clock can fall behind, so Supabase issues tokens that are already expired. `make db-doctor`
checks the drift; quitting and reopening OrbStack fixes it.

## Checks

```bash
make check      # lint + typecheck + format + unit tests
make test       # just unit tests
cd apps/web && npm run test:db   # RLS + repository tests against local Supabase (make db-start)
make e2e        # Playwright: the real app in Chromium against local Supabase
make seed       # regenerate data/seed/demo_catalog.json after editing generate_seed.py
make api-types  # regenerate docs/openapi.json + web TS types after changing optimizer models
make db-check   # database security invariants (RLS on every table, nothing for anon, ...)
```

## Repo map

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 app (App Router, TS, Tailwind v4, shadcn/ui-style components) |
| `services/optimizer` | FastAPI + OR-Tools. All pricing math lives here |
| `data/seed` | Synthetic catalog generator + generated JSON (shared by both) |
| `supabase` | Postgres migrations (RLS), generated demo seed, local stack config |
| `apps/web/e2e` | Playwright end-to-end tests |
| `docs/architecture.md` | How it fits together and the rules we don't break |
| `docs/mvp-scope.md` | What's in / out, baseline definition, the 8 demo scenarios |
| `docs/api-contract.md` | The frontend/backend boundary |

Adding shadcn components: `components.json` is set up, so `npx shadcn@latest add dialog`
works from `apps/web` on your machine.

## Working as two founders

- `main` is always green. Nobody pushes to it directly; everything goes through a PR with CI.
- Long-lived lanes, short-lived branches:
  - **Frontend lane** (`feat/frontend-ux/<thing>`): owns `apps/web/**`.
  - **Backend lane** (`feat/backend-optimizer/<thing>`): owns `services/optimizer/**`.
  - **Shared files** (`data/seed/**`, `docs/api-contract.md`, `catalog.py` + `schema.ts`):
    change only in a small dedicated PR that both of you review. Never edit them in the same
    afternoon.
- Merge small PRs (under ~400 lines) at least daily. Rebase on `main` before opening.
- The contract comes first: agree the `/v1/optimize` request/response in
  `docs/api-contract.md`, then the frontend builds against a fixture JSON while the backend
  makes it real.

## Deploying

See [`docs/deployment.md`](docs/deployment.md): Supabase (Postgres + Auth), Vercel (web), and a
container host such as Fly.io/Render/Railway for the optimizer (`services/optimizer/Dockerfile`).
None of these are covered by Claude Max; each has its own (mostly free-tier) billing.
