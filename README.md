# SupplyPilot

**One shopping list. The smartest way to buy it.**

A buyer-first purchasing tool for independent bakeries, cafés and restaurants. The buyer builds
one list; SupplyPilot finds the lowest *total delivered* cost across participating
distributors (prices, packs, stock, fees, minimums, delivery days) and explains why.

> ⚠️ **Everything in this repo runs on synthetic demo data.** Every supplier and buyer is
> fictional and labelled "(Demo)". No live prices, no live stock, no real orders.

## Status

Milestone 1 (foundation) is done. See [`docs/implementation-checklist.md`](docs/implementation-checklist.md).
The price optimizer lands in Milestone 3; until then "Find My Best Price" is disabled
rather than faked.

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

In M1 the web app reads the seed catalog directly, so it works without the optimizer running.

### Local database (Milestone 2+)

Prereq: a Docker engine. On macOS use [OrbStack](https://orbstack.dev) (`brew install --cask orbstack`,
then open it once). The Supabase CLI is pinned as a devDependency of `apps/web`, so `make setup`
installs it; no Homebrew formula needed.

```bash
make db-start   # Postgres :54322, API :54321, Mailpit (auth emails) :54324
make db-reset   # wipe and re-apply supabase/migrations
make db-stop
```

To keep the download small (~2 GB), `supabase/config.toml` turns off Studio, Storage, Realtime,
Edge Functions and Analytics. Flip `enabled = true` under any of them if you need it. The keys that
`make db-status` prints are the well-known local-only demo keys, not secrets.

## Checks

```bash
make check      # lint + typecheck + format + all tests (same as CI)
make test       # just tests
make seed       # regenerate data/seed/demo_catalog.json after editing generate_seed.py
```

## Repo map

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 app (App Router, TS, Tailwind v4, shadcn/ui-style components) |
| `services/optimizer` | FastAPI + OR-Tools. All pricing math lives here |
| `data/seed` | Synthetic catalog generator + generated JSON (shared by both) |
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

## Deploying later (not set up)

Vercel (web), a Python host such as Fly.io/Render/Railway (optimizer), Supabase (Postgres +
Auth). None of these are covered by Claude Max; each has its own (mostly free-tier) billing.
