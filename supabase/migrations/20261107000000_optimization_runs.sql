-- Milestone 4: every "Find My Best Price" result, kept per buyer org.
--
-- A run stores the exact request sent to the optimizer and its full response, so a result
-- can be shown again later exactly as it was, even after the cart or prices change.
-- Runs are append-only for buyers: no updates or deletes.

create table public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  created_at timestamptz not null default now(),
  delivery_date date not null,
  -- optimal: every line filled; partial: some lines left out (see response.problems);
  -- infeasible: nothing could be filled.
  status text not null check (status in ('optimal', 'partial', 'infeasible')),
  total_cents integer check (total_cents >= 0),
  savings_cents integer,
  supplier_count integer check (supplier_count >= 0),
  line_count integer not null check (line_count > 0),
  request jsonb not null,
  response jsonb not null,
  check ((status = 'infeasible') = (total_cents is null))
);

create index optimization_runs_org_created_idx on public.optimization_runs (org_id, created_at desc);

alter table public.optimization_runs enable row level security;
revoke all on public.optimization_runs from anon;
revoke update, delete, truncate on public.optimization_runs from authenticated;

create policy "members read org runs" on public.optimization_runs
  for select to authenticated using (public.is_org_member(org_id));

create policy "members add org runs" on public.optimization_runs
  for insert to authenticated with check (public.is_org_member(org_id));
