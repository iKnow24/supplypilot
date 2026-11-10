-- Autopilot: one tap on Home plans the next order. An agent (Claude, or a fixed script when
-- AI is off) calls the same server code a buyer would: stock -> drafted order -> vendor quotes
-- -> Find My Best Price. It stops at the plan; POs are only created when the buyer approves.
--
-- One row per run: what it produced (the optimization run it priced) and the agent's short
-- notes. Rows also cap AI runs per org per hour. Buyers can read and add their org's runs and
-- finish them (status, notes); nothing is deleted.

create table public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'planned', 'failed')),
  -- true: Claude chose the steps; false: the fixed script ran (no AI key, or over the cap).
  used_ai boolean not null,
  delivery_date date,
  optimization_run_id uuid,
  headline text check (char_length(headline) <= 200),
  notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
  error text check (char_length(error) <= 300),
  foreign key (optimization_run_id, org_id)
    references public.optimization_runs (id, org_id) on delete set null (optimization_run_id)
);

create index autopilot_runs_org_created_idx on public.autopilot_runs (org_id, created_at desc);

alter table public.autopilot_runs enable row level security;
revoke all on public.autopilot_runs from anon;
revoke delete, truncate on public.autopilot_runs from authenticated;

create policy "members read org autopilot runs" on public.autopilot_runs
  for select to authenticated using (public.is_org_member(org_id));
create policy "members start org autopilot runs" on public.autopilot_runs
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "members finish org autopilot runs" on public.autopilot_runs
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
