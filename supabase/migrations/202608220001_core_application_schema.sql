-- AbayaRidaa core application schema
-- Apply after reviewing on a fresh/staging Supabase project.
-- No passwords, API keys, or service-role credentials belong in this file.

create extension if not exists pgcrypto;

create schema if not exists private;

/* ============================================================
   Identity, roles, and authorization
   ============================================================ */
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text,
  assigned_role text not null default 'support'
    check (assigned_role in ('super_admin','general_manager','operations_manager','production','support','rep','partner')),
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  last_password_reset timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_username_uidx
  on public.user_profiles (lower(username)) where username is not null;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_user_email text not null,
  role text not null check (role in ('super_admin','general_manager','operations_manager','production','support','rep','partner')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assigned_user_email)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id, is_active);
create index if not exists user_roles_email_idx on public.user_roles (lower(assigned_user_email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, full_name, username, assigned_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'support'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    username = coalesce(excluded.username, public.user_profiles.username),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function private.has_any_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active = true
      and ur.role = any (p_roles)
  ) or exists (
    select 1
    from public.user_profiles up
    where up.id = (select auth.uid())
      and up.is_active = true
      and up.assigned_role = any (p_roles)
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.has_any_role('super_admin', 'general_manager');
$$;

revoke all on function private.has_any_role(text[]) from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.has_any_role(text[]) to authenticated;
grant execute on function private.is_admin() to authenticated;

/* ============================================================
   Products, inventory, customers, orders, and payments
   ============================================================ */
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'عام',
  fabric_meters numeric(18,6) not null default 0 check (fabric_meters >= 0),
  fabric_price_per_meter numeric(18,6) not null default 0 check (fabric_price_per_meter >= 0),
  tarha_cost numeric(18,6) not null default 0 check (tarha_cost >= 0),
  extras_cost numeric(18,6) not null default 0 check (extras_cost >= 0),
  total_cost numeric(18,6) not null default 0 check (total_cost >= 0),
  sell_price numeric(18,6) not null default 0 check (sell_price >= 0),
  stock_quantity numeric(18,3) not null default 0 check (stock_quantity >= 0),
  min_stock_alert numeric(18,3) not null default 2 check (min_stock_alert >= 0),
  color text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category, is_active);
create index if not exists products_stock_alert_idx on public.products (stock_quantity, min_stock_alert) where is_active = true;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete restrict,
  product_code text not null,
  movement_type text not null check (movement_type in ('PURCHASE','PRODUCTION','SALE','CUSTOMER_RETURN','SUPPLIER_RETURN','ADJUSTMENT','REVERSAL')),
  quantity numeric(18,3) not null check (quantity <> 0),
  quantity_before numeric(18,3) not null check (quantity_before >= 0),
  quantity_after numeric(18,3) not null check (quantity_after >= 0),
  reference_type text,
  reference_id text,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists inventory_movements_idempotency_uidx
  on public.inventory_movements (idempotency_key)
  where idempotency_key is not null;

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_code, created_at desc);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  notes text not null default '',
  source text not null default '',
  added_by_id uuid references auth.users(id) on delete set null,
  added_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_user_idx on public.customers (user_id, created_at desc);
create index if not exists customers_phone_idx on public.customers (phone);

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete restrict,
  name text not null,
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  commission_rate numeric(8,4) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_reps_owner_idx on public.sales_reps (owner_user_id, is_active);
create index if not exists sales_reps_user_idx on public.sales_reps (user_id) where user_id is not null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null default '',
  rep_id uuid references public.sales_reps(id) on delete set null,
  rep_name text,
  status text not null default 'pending' check (status in ('pending','processing','ready','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','partial','unpaid')),
  subtotal numeric(18,6) not null default 0 check (subtotal >= 0),
  discount numeric(18,6) not null default 0 check (discount >= 0),
  total numeric(18,6) not null default 0 check (total >= 0),
  paid numeric(18,6) not null default 0 check (paid >= 0),
  remaining numeric(18,6) not null default 0 check (remaining >= 0),
  due_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid <= total),
  check (remaining = total - paid)
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,6) not null check (unit_price >= 0),
  buy_price numeric(18,6) not null default 0 check (buy_price >= 0),
  total numeric(18,6) not null default 0 check (total >= 0),
  cost_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_code);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_name text not null,
  amount numeric(18,6) not null check (amount > 0),
  method text not null check (method in ('cash','transfer','card')),
  date date not null default current_date,
  notes text not null default '',
  receipt_url text,
  recorded_by_id uuid references auth.users(id) on delete set null,
  recorded_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, date desc);
create index if not exists payments_order_idx on public.payments (order_id, date desc);

/* ============================================================
   Suppliers, expenses, commissions, partners, settings, and notifications
   ============================================================ */
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  phone text not null default '',
  email text not null default '',
  company text not null default '',
  city text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_user_idx on public.suppliers (user_id, created_at desc);

create table if not exists public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_name text not null,
  type text not null check (type in ('purchase','payment','return')),
  amount numeric(18,6) not null default 0 check (amount >= 0),
  pieces numeric(18,3) not null default 0 check (pieces >= 0),
  fabric_type text not null default '',
  fabric_unit text not null default '',
  fabric_quantity numeric(18,6) not null default 0 check (fabric_quantity >= 0),
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists supplier_transactions_user_idx on public.supplier_transactions (user_id, date desc);
create index if not exists supplier_transactions_supplier_idx on public.supplier_transactions (supplier_id, date desc);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('advertising','shipping','promotions','discounts','rent','salaries','materials','maintenance','electricity','commissions','other')),
  description text not null,
  amount numeric(18,6) not null check (amount >= 0),
  date date not null default current_date,
  notes text not null default '',
  is_fixed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses (user_id, date desc);

create table if not exists public.rep_commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  rep_id uuid not null references public.sales_reps(id) on delete restrict,
  rep_name text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_number text not null,
  order_total numeric(18,6) not null default 0 check (order_total >= 0),
  commission_amount numeric(18,6) not null default 0 check (commission_amount >= 0),
  shipping_deduction numeric(18,6) not null default 0 check (shipping_deduction >= 0),
  net_commission numeric(18,6) not null default 0 check (net_commission >= 0),
  is_paid boolean not null default false,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rep_commissions_user_idx on public.rep_commissions (user_id, date desc);
create index if not exists rep_commissions_rep_idx on public.rep_commissions (rep_id, date desc);

create table if not exists public.partners_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  partner_key text not null,
  partner_name text not null default '',
  partner_email text not null default '',
  percentage numeric(8,4) not null default 0 check (percentage >= 0 and percentage <= 100),
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, partner_key)
);

create table if not exists public.partner_reports (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete restrict,
  report_key text not null,
  period_from date not null,
  period_to date not null,
  sales_total numeric(18,6) not null default 0,
  operating_costs numeric(18,6) not null default 0,
  production_costs numeric(18,6) not null default 0,
  returns_total numeric(18,6) not null default 0,
  debts_total numeric(18,6) not null default 0,
  net_profit numeric(18,6) not null default 0,
  currency char(3) not null default 'YER',
  content_hash text not null,
  report_payload jsonb not null default '{}'::jsonb,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now(),
  unique (partner_user_id, report_key, period_from, period_to, content_hash)
);

create index if not exists partner_reports_user_period_idx
  on public.partner_reports (partner_user_id, period_from desc, period_to desc);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists app_settings_user_idx on public.app_settings (user_id, key);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'system',
  recipient_name text,
  recipient_phone text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','read')),
  related_entity_type text,
  related_entity_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete set null,
  user_email text not null default '',
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_logs_user_idx on public.user_activity_logs (user_id, created_at desc);

create table if not exists public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  rule_type text not null check (rule_type in ('governorate_discount','amount_discount','product_discount')),
  condition_field text not null default '',
  condition_value text not null default '',
  discount_type text not null check (discount_type in ('fixed','percentage')),
  discount_value numeric(18,6) not null default 0 check (discount_value >= 0),
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  storage_path text,
  mime_type text,
  page_size text not null default 'A4',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  type text not null check (type in ('customer','supplier')),
  order_id uuid references public.orders(id) on delete restrict,
  order_number text,
  customer_id uuid references public.customers(id) on delete restrict,
  customer_name text,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  supplier_name text,
  rep_id uuid references public.sales_reps(id) on delete set null,
  rep_name text,
  shipping_cost numeric(18,6) not null default 0 check (shipping_cost >= 0),
  reason text not null,
  total_amount numeric(18,6) not null default 0 check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','completed','rejected')),
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,6) not null default 0 check (unit_price >= 0),
  total numeric(18,6) not null default 0 check (total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  invoice_number text not null,
  status text not null default 'issued' check (status in ('draft','issued','void')),
  total numeric(18,6) not null default 0 check (total >= 0),
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

/* ============================================================
   Inventory RPC: lock, validate, update, and append movement atomically
   ============================================================ */
create or replace function public.decrement_stock(p_code text, p_qty numeric)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_after numeric(18,3);
begin
  if (auth.uid() is null) then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception using errcode = '22023', message = 'Quantity must be positive';
  end if;
  if not private.has_any_role('super_admin','general_manager','operations_manager','production','rep') then
    raise exception using errcode = '42501', message = 'Insufficient permission';
  end if;

  select * into v_product
  from public.products
  where code = p_code and is_active = true
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found';
  end if;
  if v_product.stock_quantity < p_qty then
    raise exception using errcode = 'P0001', message = 'Insufficient stock';
  end if;

  v_after := v_product.stock_quantity - p_qty;
  update public.products
  set stock_quantity = v_after, updated_at = now()
  where id = v_product.id;

  insert into public.inventory_movements (
    product_id, product_code, movement_type, quantity,
    quantity_before, quantity_after, reference_type, actor_user_id
  ) values (
    v_product.id, v_product.code, 'SALE', -p_qty,
    v_product.stock_quantity, v_after, 'ORDER', auth.uid()
  );

  return v_after;
end;
$$;

revoke all on function public.decrement_stock(text, numeric) from public, anon;
grant execute on function public.decrement_stock(text, numeric) to authenticated;

/* ============================================================
   Updated-at trigger
   ============================================================ */
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['user_profiles','user_roles','products','customers','sales_reps','orders','suppliers','partners_config','app_settings','discount_rules','invoice_templates','returns'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

/* ============================================================
   Grants and RLS
   ============================================================ */

alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customers enable row level security;
alter table public.sales_reps enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.rep_commissions enable row level security;
alter table public.partners_config enable row level security;
alter table public.partner_reports enable row level security;
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.user_activity_logs enable row level security;
alter table public.discount_rules enable row level security;
alter table public.invoice_templates enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.invoices enable row level security;

revoke all on table
  public.user_profiles, public.user_roles, public.products, public.inventory_movements,
  public.customers, public.sales_reps, public.orders, public.order_items, public.payments,
  public.suppliers, public.supplier_transactions, public.expenses, public.rep_commissions,
  public.partners_config, public.partner_reports, public.app_settings, public.notifications,
  public.user_activity_logs, public.discount_rules, public.invoice_templates,
  public.returns, public.return_items, public.invoices
from anon, authenticated;

-- Read grants are intentionally explicit; writes are limited per table below.
grant select on public.user_profiles, public.products, public.customers, public.sales_reps,
  public.orders, public.order_items, public.payments, public.suppliers,
  public.supplier_transactions, public.expenses, public.rep_commissions,
  public.partners_config, public.partner_reports, public.app_settings,
  public.notifications, public.user_activity_logs, public.discount_rules,
  public.invoice_templates, public.returns, public.return_items, public.invoices
  to authenticated;

grant insert, update on public.user_profiles to authenticated;
grant insert, update, delete on public.customers, public.orders, public.order_items, public.payments,
  public.suppliers, public.supplier_transactions, public.sales_reps, public.rep_commissions,
  public.expenses, public.partners_config, public.app_settings, public.discount_rules,
  public.invoice_templates, public.returns, public.return_items, public.invoices
  to authenticated;
grant insert on public.user_activity_logs to authenticated;
grant update on public.notifications to authenticated;

-- Profiles: a user can read and update their own profile; admins can manage all profiles.
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

-- Roles are readable by the owner and admin, but only admins can mutate them.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists user_roles_admin_insert on public.user_roles;
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists user_roles_admin_update on public.user_roles;
create policy user_roles_admin_update on public.user_roles for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists user_roles_admin_delete on public.user_roles;
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
using ((select private.is_admin()));

-- Products are shared catalogue data; only operational roles and admins can write.
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using (is_active = true or (select private.is_admin()));
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
using ((select private.has_any_role('super_admin','general_manager','operations_manager','production')))
with check ((select private.has_any_role('super_admin','general_manager','operations_manager','production')));

-- Inventory movements are read-only from clients; functions/service jobs append movements.
drop policy if exists inventory_movements_read on public.inventory_movements;
create policy inventory_movements_read on public.inventory_movements for select to authenticated
using ((select private.has_any_role('super_admin','general_manager','operations_manager','production')));
revoke insert, update, delete, truncate on public.inventory_movements from anon, authenticated;

-- Owner-scoped business records.
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated
using ((select private.is_admin()) or user_id = (select auth.uid()));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated
using ((select private.is_admin()) or user_id = (select auth.uid()));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))));
drop policy if exists order_items_write on public.order_items;
create policy order_items_write on public.order_items for all to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update to authenticated
using ((select private.is_admin()) or user_id = (select auth.uid()))
with check ((select private.is_admin()) or user_id = (select auth.uid()));

-- Suppliers, expenses, commissions, partners, and invoices.
drop policy if exists suppliers_all on public.suppliers;
create policy suppliers_all on public.suppliers for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists supplier_transactions_all on public.supplier_transactions;
create policy supplier_transactions_all on public.supplier_transactions for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists sales_reps_all on public.sales_reps;
create policy sales_reps_all on public.sales_reps for all to authenticated
using (owner_user_id = (select auth.uid()) or (select private.is_admin()))
with check (owner_user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists rep_commissions_all on public.rep_commissions;
create policy rep_commissions_all on public.rep_commissions for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists partners_config_all on public.partners_config;
create policy partners_config_all on public.partners_config for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists partner_reports_select on public.partner_reports;
create policy partner_reports_select on public.partner_reports for select to authenticated
using (partner_user_id = (select auth.uid()) or (select private.is_admin()));
revoke insert, update, delete on public.partner_reports from anon, authenticated;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists rep_commissions_select_rep on public.rep_commissions;

-- Notifications and activity logs.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists activity_logs_select on public.user_activity_logs;
create policy activity_logs_select on public.user_activity_logs for select to authenticated
using ((select private.is_admin()) or user_id = (select auth.uid()));
drop policy if exists activity_logs_insert on public.user_activity_logs;
create policy activity_logs_insert on public.user_activity_logs for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- Public catalogue rules; admin and operations roles manage rules and templates.
drop policy if exists discount_rules_select on public.discount_rules;
create policy discount_rules_select on public.discount_rules for select to authenticated
using (user_id = (select auth.uid()) or is_active = true or (select private.is_admin()));
drop policy if exists discount_rules_write on public.discount_rules;
create policy discount_rules_write on public.discount_rules for all to authenticated
using ((select private.has_any_role('super_admin','general_manager','operations_manager')))
with check ((select private.has_any_role('super_admin','general_manager','operations_manager')));
drop policy if exists invoice_templates_select on public.invoice_templates;
create policy invoice_templates_select on public.invoice_templates for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists invoice_templates_write on public.invoice_templates;
create policy invoice_templates_write on public.invoice_templates for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

-- Returns and invoices are owner/admin scoped; approval tables are handled by the security migration.
drop policy if exists returns_all on public.returns;
create policy returns_all on public.returns for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists return_items_all on public.return_items;
create policy return_items_all on public.return_items for all to authenticated
using (exists (select 1 from public.returns r where r.id = return_id and (r.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (exists (select 1 from public.returns r where r.id = return_id and (r.user_id = (select auth.uid()) or (select private.is_admin()))));
drop policy if exists invoices_all on public.invoices;
create policy invoices_all on public.invoices for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

/* ============================================================
   Storage buckets and policies
   ============================================================ */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding', 'branding', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']),
  ('product-images', 'product-images', false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('user-files', 'user-files', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects is managed by Supabase and already protected by RLS; do not alter its ownership here.

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects for select
using (bucket_id = 'branding');
drop policy if exists branding_admin_write on storage.objects;
create policy branding_admin_write on storage.objects for insert to authenticated
with check (bucket_id = 'branding' and (select private.is_admin()));
drop policy if exists branding_admin_update on storage.objects;
create policy branding_admin_update on storage.objects for update to authenticated
using (bucket_id = 'branding' and (select private.is_admin()))
with check (bucket_id = 'branding' and (select private.is_admin()));
drop policy if exists branding_admin_delete on storage.objects;
create policy branding_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'branding' and (select private.is_admin()));

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select to authenticated
using (bucket_id = 'product-images');
drop policy if exists product_images_admin_write on storage.objects;
create policy product_images_admin_write on storage.objects for all to authenticated
using (bucket_id = 'product-images' and (select private.has_any_role('super_admin','general_manager','operations_manager')))
with check (bucket_id = 'product-images' and (select private.has_any_role('super_admin','general_manager','operations_manager')));

drop policy if exists user_files_owner_read on storage.objects;
create policy user_files_owner_read on storage.objects for select to authenticated
using (bucket_id = 'user-files' and (name like (auth.uid()::text || '/%')));
drop policy if exists user_files_owner_write on storage.objects;
create policy user_files_owner_write on storage.objects for all to authenticated
using (bucket_id = 'user-files' and (name like (auth.uid()::text || '/%')))
with check (bucket_id = 'user-files' and (name like (auth.uid()::text || '/%')));

-- Restrict default privileges for future public tables.
alter default privileges in schema public revoke all on tables from anon, authenticated;
