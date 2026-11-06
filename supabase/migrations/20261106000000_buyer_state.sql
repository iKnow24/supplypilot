-- Milestone 2: buyer-owned state (cart, saved lists, favorites, supplier preferences).
--
-- The catalog (suppliers, products, offers, prices, units) is NOT in Postgres yet: it stays in
-- data/seed/demo_catalog.json, which the optimizer also reads. Columns below that point into the
-- catalog (product_id, unit, *_supplier_id*) are therefore plain text and the web app validates
-- them against the catalog on every write.
--
-- Tenancy: every row carries org_id, and RLS allows a row only to members of that org
-- (public.org_members). Child rows repeat org_id and use composite foreign keys, so a line can
-- never point at another org's cart or list even if a client sends a crafted request.

-- ---------------------------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------------------------

create table public.buyer_orgs (
  id text primary key check (id ~ '^org_[a-z0-9_]+$'),
  name text not null,
  synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.org_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  role text not null default 'buyer' check (role in ('owner', 'buyer')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index org_members_org_id_idx on public.org_members (org_id);

-- SECURITY DEFINER so policies can consult org_members without recursing through its own RLS.
-- It only ever answers for the calling user (auth.uid()).
create function public.is_org_member(target_org text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.user_id = (select auth.uid()) and m.org_id = target_org
  );
$$;

revoke all on function public.is_org_member(text) from public, anon;
grant execute on function public.is_org_member(text) to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Saved lists (weekly order templates; also the buyer's baseline habit)
-- ---------------------------------------------------------------------------------------------

create table public.saved_lists (
  id text primary key default ('lst_' || replace(gen_random_uuid()::text, '-', '')),
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);

create table public.saved_list_lines (
  id uuid primary key default gen_random_uuid(),
  list_id text not null,
  org_id text not null,
  product_id text not null,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 100000),
  unit text not null,
  current_supplier_id text,
  position integer not null default 0,
  unique (list_id, product_id),
  foreign key (list_id, org_id) references public.saved_lists (id, org_id) on delete cascade
);

create index saved_list_lines_org_id_idx on public.saved_list_lines (org_id);

-- ---------------------------------------------------------------------------------------------
-- Cart: one working cart per org
-- ---------------------------------------------------------------------------------------------

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null unique references public.buyer_orgs (id) on delete cascade,
  delivery_date date,
  -- The saved list this cart was loaded from: the baseline for "savings vs. your usual order".
  source_list_id text,
  preferred_supplier_ids text[] not null default '{}',
  excluded_supplier_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (not (preferred_supplier_ids && excluded_supplier_ids)),
  foreign key (source_list_id, org_id) references public.saved_lists (id, org_id)
    on delete set null (source_list_id)
);

create table public.cart_lines (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  org_id text not null,
  product_id text not null,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 100000),
  unit text not null,
  current_supplier_id text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id),
  foreign key (cart_id, org_id) references public.carts (id, org_id) on delete cascade
);

create index cart_lines_org_id_idx on public.cart_lines (org_id);

-- ---------------------------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------------------------

create table public.favorites (
  org_id text not null references public.buyer_orgs (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, product_id)
);

create trigger saved_lists_touch before update on public.saved_lists
  for each row execute function public.touch_updated_at();
create trigger carts_touch before update on public.carts
  for each row execute function public.touch_updated_at();
create trigger cart_lines_touch before update on public.cart_lines
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------

alter table public.buyer_orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.saved_lists enable row level security;
alter table public.saved_list_lines enable row level security;
alter table public.carts enable row level security;
alter table public.cart_lines enable row level security;
alter table public.favorites enable row level security;

-- Nothing here is readable without signing in.
revoke all on all tables in schema public from anon;

-- Orgs and memberships are managed by admins (seed / service role), never by buyers.
revoke insert, update, delete, truncate on public.buyer_orgs, public.org_members from authenticated;

create policy "members read their org" on public.buyer_orgs
  for select to authenticated using (public.is_org_member(id));

create policy "users read their memberships" on public.org_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy "members manage org saved lists" on public.saved_lists
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "members manage org saved list lines" on public.saved_list_lines
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "members manage org cart" on public.carts
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "members manage org cart lines" on public.cart_lines
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "members manage org favorites" on public.favorites
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------------------------
-- Multi-row operations. SECURITY INVOKER (the default): they run as the caller, so RLS applies
-- to every statement inside, and each runs in one transaction.
-- ---------------------------------------------------------------------------------------------

-- The org's cart, created on first use.
create function public.ensure_cart(p_org text)
returns public.carts
language plpgsql
set search_path = ''
as $$
declare
  c public.carts;
begin
  if not public.is_org_member(p_org) then
    raise exception 'not a member of %', p_org using errcode = '42501';
  end if;
  insert into public.carts (org_id) values (p_org) on conflict (org_id) do nothing;
  select * into c from public.carts where org_id = p_org;
  return c;
end;
$$;

-- Adds a product to the end of the cart. Returns false if it was already there.
create function public.add_cart_line(
  p_org text, p_product_id text, p_quantity numeric, p_unit text, p_current_supplier_id text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  c public.carts;
  inserted integer;
begin
  c := public.ensure_cart(p_org);
  insert into public.cart_lines (cart_id, org_id, product_id, quantity, unit, current_supplier_id, position)
  select c.id, p_org, p_product_id, p_quantity, p_unit, p_current_supplier_id,
         coalesce(max(position) + 1, 0)
  from public.cart_lines where cart_id = c.id
  on conflict (cart_id, product_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

-- Replace (or merge into) the cart's lines in one transaction.
-- p_lines: [{product_id, quantity, unit, current_supplier_id?}], already validated by the app.
-- Merge keeps existing lines and overwrites quantity/unit for products present in p_lines.
create function public.set_cart_lines(p_org text, p_lines jsonb, p_mode text default 'replace')
returns void
language plpgsql
set search_path = ''
as $$
declare
  c public.carts;
  base integer;
begin
  if p_mode not in ('replace', 'merge') then
    raise exception 'mode must be replace or merge' using errcode = '22023';
  end if;
  c := public.ensure_cart(p_org);
  if p_mode = 'replace' then
    delete from public.cart_lines where cart_id = c.id;
    update public.carts set source_list_id = null where id = c.id;
  end if;
  select coalesce(max(position) + 1, 0) into base from public.cart_lines where cart_id = c.id;
  insert into public.cart_lines (cart_id, org_id, product_id, quantity, unit, current_supplier_id, position)
  select c.id, p_org,
         e.item ->> 'product_id',
         (e.item ->> 'quantity')::numeric,
         e.item ->> 'unit',
         e.item ->> 'current_supplier_id',
         base + (e.ord - 1)::integer
  from jsonb_array_elements(p_lines) with ordinality as e(item, ord)
  on conflict (cart_id, product_id) do update
    set quantity = excluded.quantity, unit = excluded.unit;
end;
$$;

-- Load a saved list into the cart (replacing it) and remember it as the baseline.
create function public.load_list_into_cart(p_org text, p_list_id text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c public.carts;
begin
  c := public.ensure_cart(p_org);
  if not exists (select 1 from public.saved_lists where id = p_list_id and org_id = p_org) then
    raise exception 'saved list % not found', p_list_id using errcode = 'P0002';
  end if;
  delete from public.cart_lines where cart_id = c.id;
  insert into public.cart_lines (cart_id, org_id, product_id, quantity, unit, current_supplier_id, position)
  select c.id, p_org, product_id, quantity, unit, current_supplier_id, position
  from public.saved_list_lines where list_id = p_list_id and org_id = p_org;
  update public.carts set source_list_id = p_list_id where id = c.id;
end;
$$;

-- Snapshot the cart as a new saved list. Returns the new list id.
create function public.save_cart_as_list(p_org text, p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  c public.carts;
  new_id text;
begin
  c := public.ensure_cart(p_org);
  if not exists (select 1 from public.cart_lines where cart_id = c.id) then
    raise exception 'cart is empty' using errcode = '22023';
  end if;
  insert into public.saved_lists (org_id, name) values (p_org, btrim(p_name)) returning id into new_id;
  insert into public.saved_list_lines (list_id, org_id, product_id, quantity, unit, current_supplier_id, position)
  select new_id, p_org, product_id, quantity, unit, current_supplier_id,
         (row_number() over (order by position, created_at))::integer - 1
  from public.cart_lines where cart_id = c.id;
  update public.carts set source_list_id = new_id where id = c.id;
  return new_id;
end;
$$;

-- Copy a saved list under a new name. Returns the new list id.
create function public.duplicate_list(p_org text, p_list_id text, p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  new_id text;
begin
  if not exists (select 1 from public.saved_lists where id = p_list_id and org_id = p_org) then
    raise exception 'saved list % not found', p_list_id using errcode = 'P0002';
  end if;
  insert into public.saved_lists (org_id, name) values (p_org, btrim(p_name)) returning id into new_id;
  insert into public.saved_list_lines (list_id, org_id, product_id, quantity, unit, current_supplier_id, position)
  select new_id, p_org, product_id, quantity, unit, current_supplier_id, position
  from public.saved_list_lines where list_id = p_list_id and org_id = p_org;
  return new_id;
end;
$$;

revoke all on function
  public.ensure_cart(text),
  public.add_cart_line(text, text, numeric, text, text),
  public.set_cart_lines(text, jsonb, text),
  public.load_list_into_cart(text, text),
  public.save_cart_as_list(text, text),
  public.duplicate_list(text, text, text)
from public, anon;

grant execute on function
  public.ensure_cart(text),
  public.add_cart_line(text, text, numeric, text, text),
  public.set_cart_lines(text, jsonb, text),
  public.load_list_into_cart(text, text),
  public.save_cart_as_list(text, text),
  public.duplicate_list(text, text, text)
to authenticated;
