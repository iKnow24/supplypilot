-- Store setup: a new bakery, café or restaurant sets itself up from documents it already has
-- (an inventory sheet, recent invoices, price sheets, vendor texts and emails).
--
-- The web app reads each file with AI, the buyer reviews and fixes everything on one screen, and
-- only then is it saved here, in one transaction (save_store_setup). The files themselves are
-- never stored: they're read in memory and dropped.
--
-- What setup writes, all into tables that already exist except store_items:
--   * store_items: the store's own items, each mapped to a catalog product or "not matched yet";
--   * price_imports (source_type 'document') + vendor_prices: their vendors and dated prices.
--     An invoice's lines also carry how many packs were bought, so invoices are their past
--     orders: who (vendor), when (invoice date), what and how much (the lines);
--   * stock_counts: on-hand amounts from the inventory sheet (append-only, as always);
--   * stock_usage (source 'invoice_estimate'): weekly use estimated from what the invoices show
--     was bought;
--   * a saved list, "Usual order", built from that weekly use.
--
-- Setting up again replaces what the last setup learned (its items, document imports, usage
-- estimates and usual order list). Shelf counts are history and are kept.

-- ---------------------------------------------------------------------------------------------
-- Weekly use estimated from invoices
-- ---------------------------------------------------------------------------------------------

alter table public.stock_usage drop constraint stock_usage_source_check;
alter table public.stock_usage add constraint stock_usage_source_check
  check (source in ('demo_estimate', 'pos', 'count_delta', 'invoice_estimate'));

-- Buyers may add and replace their own invoice estimates, and nothing else: measured usage
-- (pos, count_delta) and the demo's seeded usage stay read-only.
grant insert, delete on public.stock_usage to authenticated;

create policy "members add org usage estimates" on public.stock_usage
  for insert to authenticated
  with check (public.is_org_member(org_id) and source = 'invoice_estimate');
create policy "members replace org usage estimates" on public.stock_usage
  for delete to authenticated
  using (public.is_org_member(org_id) and source = 'invoice_estimate');

-- ---------------------------------------------------------------------------------------------
-- Vendor prices that came from setup documents, and what was bought on invoices
-- ---------------------------------------------------------------------------------------------

alter table public.price_imports drop constraint price_imports_source_type_check;
alter table public.price_imports add constraint price_imports_source_type_check
  check (source_type in ('screenshot', 'document'));

-- On an invoice line: how many packs were bought. Null on price lists, texts and emails.
alter table public.vendor_prices
  add column packs numeric(12, 3) check (packs > 0 and packs <= 100000);

-- ---------------------------------------------------------------------------------------------
-- The store's own items
-- ---------------------------------------------------------------------------------------------

create table public.store_items (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  -- The item as the store's documents call it ("AP flour 50#", "Lavender buds, culinary").
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- The catalog product it is. Null: not matched yet. Those are kept so nothing the buyer
  -- uploaded silently disappears, but they are never planned or priced until matched.
  product_id text,
  vendor_name text check (char_length(vendor_name) <= 80),
  -- What the documents said about it, for the buyer ("Bought 2 × 25 lb, $41.00 a pack").
  note text check (char_length(note) <= 200),
  source text not null default 'documents' check (source in ('documents')),
  created_at timestamptz not null default now()
);

create unique index store_items_org_product_key
  on public.store_items (org_id, product_id) where product_id is not null;
create unique index store_items_org_unmatched_name_key
  on public.store_items (org_id, lower(btrim(name))) where product_id is null;

alter table public.store_items enable row level security;
revoke all on public.store_items from anon;
-- Items are replaced as a whole by the next setup, never edited one by one.
revoke update, truncate on public.store_items from authenticated;

create policy "members read org store items" on public.store_items
  for select to authenticated using (public.is_org_member(org_id));
create policy "members add org store items" on public.store_items
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "members delete org store items" on public.store_items
  for delete to authenticated using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------------------------
-- Save a reviewed setup, atomically
-- ---------------------------------------------------------------------------------------------

-- SECURITY INVOKER (the default), so RLS applies to every statement. The web app validates
-- p_setup against the catalog first; the checks here are a second line of defence on sizes.
-- p_setup: {
--   items:   [{name, product_id|null, vendor_name|null, note|null}],
--   imports: [{vendor_name, supplier_id|null, document_kind, document_date|null,
--              lines: [{product_id, description, pack_quantity, pack_unit, pack_label,
--                       price_cents, confidence, mapping_method, packs|null}]}],
--   counts:  [{product_id, quantity, unit}],
--   usage:   [{product_id, week_start, quantity, unit}],
--   usual_list: {name, lines: [{product_id, quantity, unit, current_supplier_id|null}]} | null
-- }
-- Returns the usual order list's id (null when there is none).
create function public.save_store_setup(p_org text, p_setup jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  imp jsonb;
  new_import uuid;
  list_name text;
  v_list text;
begin
  if not public.is_org_member(p_org) then
    raise exception 'not a member of %', p_org using errcode = '42501';
  end if;
  if jsonb_typeof(p_setup -> 'items') <> 'array'
     or jsonb_typeof(p_setup -> 'imports') <> 'array'
     or jsonb_typeof(p_setup -> 'counts') <> 'array'
     or jsonb_typeof(p_setup -> 'usage') <> 'array' then
    raise exception 'malformed setup' using errcode = '22023';
  end if;
  if jsonb_array_length(p_setup -> 'items') = 0 then
    raise exception 'nothing to set up' using errcode = '22023';
  end if;
  if jsonb_array_length(p_setup -> 'items') > 300
     or jsonb_array_length(p_setup -> 'imports') > 30
     or jsonb_array_length(p_setup -> 'counts') > 300
     or jsonb_array_length(p_setup -> 'usage') > 2400 then
    raise exception 'setup too large' using errcode = '22023';
  end if;

  -- What the last setup learned is replaced. Shelf counts are history and stay.
  delete from public.store_items where org_id = p_org and source = 'documents';
  delete from public.price_imports where org_id = p_org and source_type = 'document';
  delete from public.stock_usage where org_id = p_org and source = 'invoice_estimate';

  insert into public.store_items (org_id, name, product_id, vendor_name, note)
  select p_org, btrim(i ->> 'name'), i ->> 'product_id', i ->> 'vendor_name', i ->> 'note'
  from jsonb_array_elements(p_setup -> 'items') as i;

  for imp in select * from jsonb_array_elements(p_setup -> 'imports') loop
    if jsonb_typeof(imp -> 'lines') <> 'array' or jsonb_array_length(imp -> 'lines') = 0
       or jsonb_array_length(imp -> 'lines') > 200 then
      raise exception 'each document needs 1 to 200 lines' using errcode = '22023';
    end if;
    insert into public.price_imports (org_id, vendor_name, supplier_id, source_type,
      document_kind, document_date)
    values (p_org, btrim(imp ->> 'vendor_name'), imp ->> 'supplier_id', 'document',
      imp ->> 'document_kind', (imp ->> 'document_date')::date)
    returning id into new_import;
    insert into public.vendor_prices (import_id, org_id, product_id, description, pack_quantity,
      pack_unit, pack_label, price_cents, confidence, mapping_method, packs)
    select new_import, p_org, l ->> 'product_id', l ->> 'description',
           (l ->> 'pack_quantity')::numeric, l ->> 'pack_unit', l ->> 'pack_label',
           (l ->> 'price_cents')::integer, l ->> 'confidence', l ->> 'mapping_method',
           (l ->> 'packs')::numeric
    from jsonb_array_elements(imp -> 'lines') as l;
  end loop;

  insert into public.stock_counts (org_id, product_id, quantity, unit)
  select p_org, c ->> 'product_id', (c ->> 'quantity')::numeric, c ->> 'unit'
  from jsonb_array_elements(p_setup -> 'counts') as c;

  -- An estimate never overwrites usage that was measured (or seeded for the demo).
  insert into public.stock_usage (org_id, product_id, week_start, quantity, unit, source)
  select p_org, u ->> 'product_id', (u ->> 'week_start')::date, (u ->> 'quantity')::numeric,
         u ->> 'unit', 'invoice_estimate'
  from jsonb_array_elements(p_setup -> 'usage') as u
  on conflict (org_id, product_id, week_start) do nothing;

  if jsonb_typeof(p_setup -> 'usual_list') = 'object'
     and jsonb_typeof(p_setup -> 'usual_list' -> 'lines') = 'array'
     and jsonb_array_length(p_setup -> 'usual_list' -> 'lines') > 0 then
    if jsonb_array_length(p_setup -> 'usual_list' -> 'lines') > 300 then
      raise exception 'usual order too large' using errcode = '22023';
    end if;
    list_name := btrim(p_setup -> 'usual_list' ->> 'name');
    select s.id into v_list from public.saved_lists s
      where s.org_id = p_org and s.name = list_name;
    if v_list is null then
      insert into public.saved_lists (org_id, name) values (p_org, list_name)
      returning id into v_list;
    else
      delete from public.saved_list_lines l where l.list_id = v_list;
      update public.saved_lists set name = list_name where id = v_list;
    end if;
    insert into public.saved_list_lines (list_id, org_id, product_id, quantity, unit,
      current_supplier_id, position)
    select v_list, p_org, e.line ->> 'product_id', (e.line ->> 'quantity')::numeric,
           e.line ->> 'unit', e.line ->> 'current_supplier_id', (e.ord - 1)::integer
    from jsonb_array_elements(p_setup -> 'usual_list' -> 'lines') with ordinality as e(line, ord);
  end if;

  return v_list;
end;
$$;

revoke all on function public.save_store_setup(text, jsonb) from public, anon;
grant execute on function public.save_store_setup(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- "Reset demo" also forgets a document setup
-- ---------------------------------------------------------------------------------------------

-- reset_demo_org() (migration 20261113000000_demo_reset) puts a fictional demo business back to
-- its starting state. It must also clear what store setup learned: the store's items and the
-- usage estimated from its invoices (seeded demo usage stays). Its document imports and the
-- usual order list are already covered (price_imports and saved_lists are cleared). Unchanged
-- otherwise, and create or replace keeps its grants.
create or replace function public.reset_demo_org(p_org text)
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
  -- What "Set up from your documents" learned.
  delete from public.store_items where org_id = p_org;
  delete from public.stock_usage where org_id = p_org and source = 'invoice_estimate';

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
