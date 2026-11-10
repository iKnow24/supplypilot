-- Vendor prices a buyer adds from a screenshot or photo (price list, invoice, email, text).
--
-- Real supplier prices are negotiated and not public, so the buyer brings them in: the web app
-- reads the image with AI, the buyer reviews and corrects every line, and only the lines they
-- approve are saved here. The image itself is never stored.
--
-- price_imports: one row per screenshot (who the vendor is, what kind of document, its date).
-- vendor_prices: the approved lines. Prices are dated by the import (document date if the buyer
-- confirmed one, else the upload day) and are shown as "your quote", next to catalog offers.
--
-- product_id / supplier_id / pack_unit point into the catalog (still the seed file), so they're
-- text and the server action validates them on every write, like the cart.
--
-- Buyers add imports (atomically, through save_price_import) and can delete one, which deletes
-- its prices. Nothing is ever edited in place: a new quote is a new import.

create table public.price_imports (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  vendor_name text not null check (char_length(btrim(vendor_name)) between 1 and 80),
  -- The catalog supplier this vendor is, when it is one. Null for the buyer's own vendors.
  supplier_id text,
  source_type text not null default 'screenshot' check (source_type in ('screenshot')),
  -- What the image showed, as read by AI and confirmed by the buyer.
  document_kind text not null
    check (document_kind in ('price_list', 'invoice', 'email', 'text_message', 'other')),
  document_date date,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index price_imports_org_created_idx on public.price_imports (org_id, created_at desc);

create table public.vendor_prices (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  org_id text not null,
  product_id text not null,
  -- The line as it appeared on the document, for the buyer's reference.
  description text not null check (char_length(description) between 1 and 200),
  pack_quantity numeric(12, 3) not null check (pack_quantity > 0),
  pack_unit text not null,
  pack_label text not null check (char_length(pack_label) between 1 and 80),
  price_cents integer not null check (price_cents > 0 and price_cents <= 10000000),
  -- How sure the AI was when it read the line; the buyer approved it either way.
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  -- ai_suggested: the buyer kept the AI's product match; manual: the buyer picked the product.
  mapping_method text not null check (mapping_method in ('ai_suggested', 'manual')),
  created_at timestamptz not null default now(),
  foreign key (import_id, org_id) references public.price_imports (id, org_id) on delete cascade
);

create index vendor_prices_org_product_idx on public.vendor_prices (org_id, product_id);
create index vendor_prices_import_idx on public.vendor_prices (import_id);

alter table public.price_imports enable row level security;
alter table public.vendor_prices enable row level security;
revoke all on public.price_imports, public.vendor_prices from anon;
revoke update, truncate on public.price_imports, public.vendor_prices from authenticated;
-- Lines go away with their import, never one by one.
revoke delete on public.vendor_prices from authenticated;

create policy "members read org price imports" on public.price_imports
  for select to authenticated using (public.is_org_member(org_id));
create policy "members add org price imports" on public.price_imports
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "members delete org price imports" on public.price_imports
  for delete to authenticated using (public.is_org_member(org_id));

create policy "members read org vendor prices" on public.vendor_prices
  for select to authenticated using (public.is_org_member(org_id));
create policy "members add org vendor prices" on public.vendor_prices
  for insert to authenticated with check (public.is_org_member(org_id));

-- One row per image sent to the AI, so the app can cap reads per org (each one costs money,
-- and the public demo signs visitors in automatically). Append-only for buyers.
create table public.price_reads (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index price_reads_org_created_idx on public.price_reads (org_id, created_at desc);

alter table public.price_reads enable row level security;
revoke all on public.price_reads from anon;
revoke update, delete, truncate on public.price_reads from authenticated;

create policy "members read org price reads" on public.price_reads
  for select to authenticated using (public.is_org_member(org_id));
create policy "members log org price reads" on public.price_reads
  for insert to authenticated with check (public.is_org_member(org_id));

-- One screenshot's approved lines, saved in one transaction. SECURITY INVOKER (the default), so
-- RLS applies to both inserts. p_lines: [{product_id, description, pack_quantity, pack_unit,
-- pack_label, price_cents, confidence, mapping_method}].
create function public.save_price_import(
  p_org text,
  p_vendor_name text,
  p_supplier_id text,
  p_document_kind text,
  p_document_date date,
  p_lines jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'approve at least one line' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 200 then
    raise exception 'too many lines' using errcode = '22023';
  end if;
  insert into public.price_imports (org_id, vendor_name, supplier_id, document_kind, document_date)
  values (p_org, btrim(p_vendor_name), p_supplier_id, p_document_kind, p_document_date)
  returning id into new_id;
  insert into public.vendor_prices (import_id, org_id, product_id, description, pack_quantity,
    pack_unit, pack_label, price_cents, confidence, mapping_method)
  select new_id, p_org, l ->> 'product_id', l ->> 'description', (l ->> 'pack_quantity')::numeric,
         l ->> 'pack_unit', l ->> 'pack_label', (l ->> 'price_cents')::integer,
         l ->> 'confidence', l ->> 'mapping_method'
  from jsonb_array_elements(p_lines) as l;
  return new_id;
end;
$$;

revoke all on function public.save_price_import(text, text, text, text, date, jsonb)
  from public, anon;
grant execute on function public.save_price_import(text, text, text, text, date, jsonb)
  to authenticated;
