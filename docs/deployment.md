# Deploying SupplyPilot

Three pieces, each on a host made for it:

| Piece | Where | Why |
| --- | --- | --- |
| Postgres + Auth | **Supabase** (hosted project) | Same stack as local; RLS does the tenancy |
| Web app (`apps/web`) | **Vercel** | Next.js 16, server actions, the proxy |
| Optimizer (`services/optimizer`) | Any container host: **Fly.io**, **Render**, **Railway** | Python + OR-Tools; the image is ~1 GB |

```
Browser ──> Vercel (Next.js) ──server-to-server──> Optimizer (X-API-Key)
                 │
                 └──> Supabase (publishable key + the user's session; RLS enforces tenancy)
```

The browser only ever talks to Vercel. It never calls Supabase or the optimizer directly, so the
CSP allows no third-party origins.

> ⚠️ **What a deploy of this repo is:** a public demo on synthetic data with demo sign-in. It is
> not ready for real buyers or real prices. See "Before real buyers" at the end.

---

## 1. Supabase

1. Create a project at supabase.com. Note its **project ref** and the database password.
2. Link and push the schema from the repo root. **Supabase CLI v3 targets your local database
   unless you pass `--remote`.**

   ```bash
   apps/web/node_modules/.bin/supabase --workdir . link --project-ref <ref>
   apps/web/node_modules/.bin/supabase --workdir . db push --remote --dry-run
   apps/web/node_modules/.bin/supabase --workdir . db push --remote --include-seed
   ```

   `--include-seed` creates the three **fictional** demo buyers, their demo logins (password in
   `supabase/generate_seed_sql.py`) and saved lists. Leave it out for anything but a demo.
3. In the dashboard, **Authentication → Sign In / Providers**: turn **off** "Allow new users to
   sign up". The demo only uses the seeded accounts.
4. **Project Settings → API Keys**: copy the project URL and the **publishable** key. The web app
   never needs the secret / service-role key; don't put it anywhere in Vercel.
5. Check the security invariants against the hosted database too:

   ```bash
   DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     sh supabase/check-security.sh   # needs psql locally (brew install libpq)
   ```

   Locally and in CI, `make db-check` runs them: RLS on every table, nothing granted to `anon`, no
   function callable by `anon`, and every `SECURITY DEFINER` function with a pinned `search_path`.

## 2. Optimizer

The image is built from the **repo root** (it bundles `data/seed/demo_catalog.json`):

```bash
docker build -f services/optimizer/Dockerfile -t supplypilot-optimizer .
docker run --rm -p 8000:8000 -e OPTIMIZER_API_KEY=dev-only supplypilot-optimizer
curl localhost:8000/v1/health
```

Generate one random secret for the two services to share:

```bash
openssl rand -base64 32
```

| Env var | Value |
| --- | --- |
| `OPTIMIZER_API_KEY` | the secret. With it set, `/v1/optimize` answers 401 without `X-API-Key` |
| `PORT` | set by most hosts; the image defaults to 8000 |
| `SUPPLYPILOT_CATALOG_PATH` | optional; defaults to the bundled demo catalog |

- **Fly.io:** `fly launch --dockerfile services/optimizer/Dockerfile --no-deploy` (from the repo root),
  `fly secrets set OPTIMIZER_API_KEY=...`, `fly deploy`. Add an HTTP check on `/v1/health`.
- **Render:** New Web Service → Docker, root directory = repo root, Dockerfile path
  `services/optimizer/Dockerfile`, health check path `/v1/health`, add the secret.
- **Railway:** New service from the repo, set `RAILWAY_DOCKERFILE_PATH=services/optimizer/Dockerfile`,
  add the secret.

Give it at least **1 GB RAM**. A solve is milliseconds for these basket sizes, but OR-Tools is a big
import. CI's `optimizer-image` job builds the image, then checks it starts, rejects a call without
the key, and prices a basket with it.

## 3. Web app on Vercel

1. Import the GitHub repo. **Root Directory: `apps/web`**. Framework preset: Next.js. Leave
   "Include files outside the root directory" on: the app reads `data/seed/demo_catalog.json`, and
   `next.config.ts` traces it from the repo root.
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key |
   | `OPTIMIZER_URL` | the optimizer's public URL, e.g. `https://supplypilot-optimizer.fly.dev` |
   | `OPTIMIZER_API_KEY` | the same secret as the optimizer |
   | `DEMO_AUTH` | `on`, but **only** for the synthetic demo (see below) |

3. Deploy, then check:
   - `curl -sI https://<your-app>/ | grep -iE "content-security|x-frame|strict-transport"`
   - Load a saved list, pick a date, run Find My Best Price, approve, download a PO.

Security headers come from `src/lib/security/headers.ts`: a per-request CSP with a nonce, frame
denial, `nosniff`, a strict referrer policy and permissions policy, and HSTS.

## 4. Running it as a public demo

- With `DEMO_AUTH=on`, every visitor is signed in as one of three **shared** demo buyers. Visitors
  see each other's cart edits, lists and POs. That's fine for synthetic data, and it's why this
  can't hold real data.
- Reset the demo before showing it, or on a schedule:
  `apps/web/node_modules/.bin/supabase --workdir . db reset --remote` (re-runs migrations + seed;
  it **wipes everything**).
- The demo clock is fixed (Nov 5, 2026), so the delivery dates in `docs/demo-script.md` keep working.

## 5. Before real buyers (not done in this repo)

- **Real sign-in** (Supabase magic link or SSO) and org invitations. Turn `DEMO_AUTH` off and don't
  seed demo users.
- **Real supplier data** through the catalog adapters, with `source` metadata and the freshness
  policy enforced as now. Never ship the synthetic catalog with real buyers.
- **Rate limiting** on Find My Best Price and exports (e.g. Vercel Firewall rules), plus a request
  timeout and concurrency cap on the optimizer host.
- **Backups and point-in-time recovery** on the Supabase plan you choose; a privacy policy and
  terms; error monitoring on both services.
- Keep the optimizer private if your host allows it (private networking), with the API key as a
  second lock.
