-- One-tap "Reset demo": put a FICTIONAL demo business back to its starting state between
-- in-store demos (saved lists and shelf counts as seeded; no cart, results, POs, Autopilot runs,
-- imported vendor prices or favorites). Real businesses can never be reset this way.
--
-- demo_seed holds each demo org's starting lists and counts as JSON. It is written by
-- supabase/seed.sql (generated from data/seed/demo_catalog.json) and read only by the function.

create table public.demo_seed (
  org_id text primary key references public.buyer_orgs (id) on delete cascade,
  data jsonb not null
);

alter table public.demo_seed enable row level security;
revoke all on public.demo_seed from anon, authenticated;
grant select on public.demo_seed to authenticated;
create policy "members read their demo seed" on public.demo_seed
  for select to authenticated using (public.is_org_member(org_id));

-- data: {"lists": [{"id", "name", "lines": [{"product_id", "quantity", "unit",
--         "current_supplier_id"}]}], "counts": [{"product_id", "quantity", "unit", "counted_at"}]}
create function public.reset_demo_org(p_org text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  seed jsonb;
  l jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'not a member of %', p_org using errcode = '42501';
  end if;
  if not exists (select 1 from public.buyer_orgs where id = p_org and synthetic) then
    raise exception 'only demo businesses can be reset' using errcode = '42501';
  end if;
  select data into seed from public.demo_seed where org_id = p_org;
  if seed is null then
    raise exception 'no starting data for %', p_org using errcode = 'P0002';
  end if;

  -- Everything the buyer did during demos. Children cascade (lines, vendor prices, PO lines).
  delete from public.autopilot_runs where org_id = p_org;
  delete from public.purchase_orders where org_id = p_org;
  delete from public.optimization_runs where org_id = p_org;
  delete from public.price_reads where org_id = p_org;
  delete from public.price_imports where org_id = p_org;
  delete from public.carts where org_id = p_org;
  delete from public.favorites where org_id = p_org;
  delete from public.saved_lists where org_id = p_org;
  delete from public.stock_counts where org_id = p_org;

  -- The starting lists and shelf counts.
  for l in select * from jsonb_array_elements(seed -> 'lists') loop
    insert into public.saved_lists (id, org_id, name) values (l ->> 'id', p_org, l ->> 'name');
    insert into public.saved_list_lines
      (list_id, org_id, product_id, quantity, unit, current_supplier_id, position)
    select l ->> 'id', p_org, x.value ->> 'product_id', (x.value ->> 'quantity')::numeric,
           x.value ->> 'unit', x.value ->> 'current_supplier_id', (x.ordinality - 1)::integer
      from jsonb_array_elements(l -> 'lines') with ordinality x;
  end loop;

  insert into public.stock_counts (org_id, product_id, quantity, unit, counted_at)
  select p_org, c ->> 'product_id', (c ->> 'quantity')::numeric, c ->> 'unit',
         (c ->> 'counted_at')::timestamptz
    from jsonb_array_elements(seed -> 'counts') c;
end;
$$;

revoke all on function public.reset_demo_org(text) from public, anon;
grant execute on function public.reset_demo_org(text) to authenticated;
