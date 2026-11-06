-- Milestone 5: draft purchase orders, one per supplier, created from an approved result.
--
-- A PO is a SNAPSHOT: supplier and product names, SKUs, pack sizes, prices, delivery address
-- and cutoff are copied in when the buyer approves, so a PO never changes behind their back
-- when the catalog does. SupplyPilot never sends POs anywhere: the buyer exports them
-- (CSV/PDF) and sends them themselves.
--
-- Status is only ever 'draft' or 'exported'. Drafts can be discarded; exported POs are
-- permanent. Buyers can't edit lines: to change an order, edit the cart and run again.

alter table public.optimization_runs add constraint optimization_runs_id_org_key unique (id, org_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  run_id uuid not null,
  number text not null,
  supplier_id text not null,
  supplier_name text not null,
  status text not null default 'draft' check (status in ('draft', 'exported')),
  delivery_date date not null,
  order_by_date date not null,
  order_by_time text not null check (order_by_time ~ '^\d{2}:\d{2}$'),
  deliver_to jsonb not null,
  items_subtotal_cents integer not null check (items_subtotal_cents >= 0),
  delivery_fee_cents integer not null check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents = items_subtotal_cents + delivery_fee_cents),
  created_at timestamptz not null default now(),
  exported_at timestamptz,
  unique (id, org_id),
  unique (org_id, number),
  unique (run_id, supplier_id), -- approving the same result twice can't duplicate POs
  check ((status = 'exported') = (exported_at is not null)),
  foreign key (run_id, org_id) references public.optimization_runs (id, org_id) on delete cascade
);

create index purchase_orders_org_created_idx on public.purchase_orders (org_id, created_at desc);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null,
  org_id text not null,
  position integer not null,
  product_id text not null,
  product_name text not null,
  requested_product_id text not null, -- differs from product_id for an approved equivalent
  offer_id text not null,
  supplier_sku text not null,
  packs integer not null check (packs > 0),
  pack_label text not null,
  pack_quantity text not null,
  pack_unit text not null,
  pack_price_cents integer not null check (pack_price_cents >= 0),
  price_basis text not null check (price_basis in ('contract', 'list', 'volume_tier')),
  line_total_cents integer not null check (line_total_cents = packs * pack_price_cents),
  unique (po_id, position),
  foreign key (po_id, org_id) references public.purchase_orders (id, org_id) on delete cascade
);

create index purchase_order_lines_org_idx on public.purchase_order_lines (org_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
revoke all on public.purchase_orders, public.purchase_order_lines from anon;
-- Writes go through the functions below (atomic, validated); reads and draft deletes are direct.
revoke insert, update, truncate on public.purchase_orders, public.purchase_order_lines from authenticated;
revoke delete on public.purchase_order_lines from authenticated;

create policy "members read org POs" on public.purchase_orders
  for select to authenticated using (public.is_org_member(org_id));
create policy "members discard org draft POs" on public.purchase_orders
  for delete to authenticated using (public.is_org_member(org_id) and status = 'draft');
create policy "members read org PO lines" on public.purchase_order_lines
  for select to authenticated using (public.is_org_member(org_id));

-- Create one draft PO per supplier for a run, atomically. Idempotent: a supplier that already
-- has a PO for this run is skipped. Returns the run's PO ids.
-- p_orders: [{supplier_id, supplier_name, delivery_date, order_by_date, order_by_time,
--             deliver_to, items_subtotal_cents, delivery_fee_cents, lines: [...]}]
create function public.create_purchase_orders(p_org text, p_run uuid, p_orders jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb;
  l jsonb;
  new_id uuid;
  prefix text;
  today text;
  seq integer;
  pos integer;
  sum_lines integer;
begin
  if not public.is_org_member(p_org) then
    raise exception 'not a member of %', p_org using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.optimization_runs r
    where r.id = p_run and r.org_id = p_org and r.status in ('optimal', 'partial')
  ) then
    raise exception 'result % not found or has no plan', p_run using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) = 0 then
    raise exception 'no purchase orders to create' using errcode = '22023';
  end if;

  prefix := upper(left(regexp_replace(p_org, '^org_', ''), 3));
  today := to_char(now() at time zone 'America/New_York', 'YYMMDD');

  for o in select * from jsonb_array_elements(p_orders) loop
    if exists (
      select 1 from public.purchase_orders
      where run_id = p_run and supplier_id = o ->> 'supplier_id'
    ) then
      continue;
    end if;
    if jsonb_array_length(o -> 'lines') = 0 then
      raise exception 'purchase order without lines' using errcode = '22023';
    end if;
    select coalesce(sum((x ->> 'line_total_cents')::integer), 0) into sum_lines
      from jsonb_array_elements(o -> 'lines') x;
    if sum_lines <> (o ->> 'items_subtotal_cents')::integer then
      raise exception 'line totals do not add up' using errcode = '22023';
    end if;

    select count(*) + 1 into seq from public.purchase_orders
      where org_id = p_org and number like prefix || '-' || today || '-%';
    insert into public.purchase_orders (
      org_id, run_id, number, supplier_id, supplier_name, delivery_date, order_by_date,
      order_by_time, deliver_to, items_subtotal_cents, delivery_fee_cents, total_cents
    ) values (
      p_org, p_run, prefix || '-' || today || '-' || lpad(seq::text, 3, '0'),
      o ->> 'supplier_id', o ->> 'supplier_name', (o ->> 'delivery_date')::date,
      (o ->> 'order_by_date')::date, o ->> 'order_by_time', o -> 'deliver_to',
      (o ->> 'items_subtotal_cents')::integer, (o ->> 'delivery_fee_cents')::integer,
      (o ->> 'items_subtotal_cents')::integer + (o ->> 'delivery_fee_cents')::integer
    ) returning id into new_id;

    pos := 0;
    for l in select * from jsonb_array_elements(o -> 'lines') loop
      insert into public.purchase_order_lines (
        po_id, org_id, position, product_id, product_name, requested_product_id, offer_id,
        supplier_sku, packs, pack_label, pack_quantity, pack_unit, pack_price_cents,
        price_basis, line_total_cents
      ) values (
        new_id, p_org, pos, l ->> 'product_id', l ->> 'product_name', l ->> 'requested_product_id',
        l ->> 'offer_id', l ->> 'supplier_sku', (l ->> 'packs')::integer, l ->> 'pack_label',
        l ->> 'pack_quantity', l ->> 'pack_unit', (l ->> 'pack_price_cents')::integer,
        l ->> 'price_basis', (l ->> 'line_total_cents')::integer
      );
      pos := pos + 1;
    end loop;
  end loop;

  return query select id from public.purchase_orders where run_id = p_run and org_id = p_org order by number;
end;
$$;

-- Draft -> Exported, once. Exporting again is fine and keeps the first export time.
create function public.mark_po_exported(p_org text, p_po uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exported_at timestamptz;
begin
  if not public.is_org_member(p_org) then
    raise exception 'not a member of %', p_org using errcode = '42501';
  end if;
  update public.purchase_orders
     set status = 'exported', exported_at = coalesce(exported_at, now())
   where id = p_po and org_id = p_org
  returning exported_at into v_exported_at;
  if v_exported_at is null then
    raise exception 'purchase order % not found', p_po using errcode = 'P0002';
  end if;
  return v_exported_at;
end;
$$;

revoke all on function public.create_purchase_orders(text, uuid, jsonb), public.mark_po_exported(text, uuid)
  from public, anon;
grant execute on function public.create_purchase_orders(text, uuid, jsonb), public.mark_po_exported(text, uuid)
  to authenticated;
