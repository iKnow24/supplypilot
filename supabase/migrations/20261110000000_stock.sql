-- Stock: what a buyer has on hand and how fast they use it, for the Stock page.
--
-- stock_counts is an append-only log: each shelf count is a new row and the latest one per
-- product is what's on hand. Buyers add counts; they never edit or delete history.
--
-- stock_usage is weekly use per product. In the demo it's seeded (source 'demo_estimate');
-- in production it would come from the buyer's register sales and recipes ('pos') or from
-- the difference between counts plus deliveries ('count_delta'). Read-only for buyers.

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  product_id text not null,
  quantity numeric(12, 3) not null check (quantity >= 0),
  unit text not null,
  counted_at timestamptz not null default now()
);

create index stock_counts_org_product_idx
  on public.stock_counts (org_id, product_id, counted_at desc);

create table public.stock_usage (
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  product_id text not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  quantity numeric(12, 3) not null check (quantity >= 0),
  unit text not null,
  source text not null check (source in ('demo_estimate', 'pos', 'count_delta')),
  primary key (org_id, product_id, week_start)
);

alter table public.stock_counts enable row level security;
alter table public.stock_usage enable row level security;
revoke all on public.stock_counts, public.stock_usage from anon;
revoke update, delete, truncate on public.stock_counts from authenticated;
revoke insert, update, delete, truncate on public.stock_usage from authenticated;

create policy "members read org stock counts" on public.stock_counts
  for select to authenticated using (public.is_org_member(org_id));
create policy "members add org stock counts" on public.stock_counts
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "members read org stock usage" on public.stock_usage
  for select to authenticated using (public.is_org_member(org_id));
