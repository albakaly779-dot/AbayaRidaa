-- AbayaRidaa: security, production, approvals, partner signatures, and append-only audit events
-- Apply this migration in a test Supabase project first.

create extension if not exists pgcrypto;

/* ============================================================
   Production and operating cost records
   ============================================================ */
create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  product_id uuid,
  product_name text not null,
  production_date date not null default current_date,
  shift text not null default 'غير محددة',
  good_quantity numeric(18,3) not null default 0 check (good_quantity >= 0),
  defective_quantity numeric(18,3) not null default 0 check (defective_quantity >= 0),
  material_cost numeric(18,6) not null default 0 check (material_cost >= 0),
  labor_cost numeric(18,6) not null default 0 check (labor_cost >= 0),
  overhead_cost numeric(18,6) not null default 0 check (overhead_cost >= 0),
  other_cost numeric(18,6) not null default 0 check (other_cost >= 0),
  total_cost numeric(18,6) generated always as (material_cost + labor_cost + overhead_cost + other_cost) stored,
  unit_cost numeric(18,6) generated always as (
    case when good_quantity > 0
      then (material_cost + labor_cost + overhead_cost + other_cost) / good_quantity
      else 0
    end
  ) stored,
  currency char(3) not null default 'SAR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED')),
  notes text,
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  posted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (good_quantity + defective_quantity > 0)
);

create index if not exists production_batches_date_idx
  on public.production_batches (production_date desc, status);

create index if not exists production_batches_created_by_idx
  on public.production_batches (created_by, production_date desc);

create table if not exists public.production_cost_lines (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  cost_type text not null check (cost_type in ('MATERIAL', 'LABOR', 'OVERHEAD', 'OTHER')),
  description text not null,
  quantity numeric(18,6),
  unit_cost numeric(18,6),
  amount numeric(18,6) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

/* ============================================================
   Return approval workflow
   ============================================================ */
create table if not exists public.return_approval_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('CUSTOMER_RETURN', 'SUPPLIER_RETURN')),
  reference_id text,
  reference_number text,
  counterparty_name text,
  amount numeric(18,6) not null default 0 check (amount >= 0),
  reason_code text not null,
  reason_details text not null,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED')),
  decision_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  executed_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, idempotency_key),
  check (length(trim(reason_details)) >= 5)
);

create index if not exists return_approval_status_idx
  on public.return_approval_requests (status, created_at desc);

create table if not exists public.return_approval_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.return_approval_requests(id) on delete cascade,
  product_code text,
  product_name text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,6) not null default 0 check (unit_price >= 0),
  condition text not null default 'UNKNOWN' check (condition in ('RESELLABLE', 'DAMAGED', 'NEEDS_REPAIR', 'UNKNOWN')),
  disposition text not null default 'REVIEW' check (disposition in ('RESTOCK', 'REPAIR', 'SCRAP', 'RETURN_TO_SUPPLIER', 'REVIEW')),
  created_at timestamptz not null default now()
);

create table if not exists public.return_approval_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.return_approval_requests(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'EXECUTE', 'CANCEL')),
  comment text,
  created_at timestamptz not null default now()
);

/* ============================================================
   Partner report signatures
   ============================================================ */
create table if not exists public.partner_report_signatures (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete restrict,
  report_key text not null,
  period_from date not null,
  period_to date not null,
  content_hash text not null,
  consent_text text not null,
  typed_legal_name text not null,
  status text not null default 'SIGNED' check (status in ('SIGNED', 'REJECTED', 'SUPERSEDED')),
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (partner_user_id, report_key, content_hash)
);

/* ============================================================
   Server-side append-only audit events
   ============================================================ */
create table if not exists public.audit_events (
  sequence bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  tenant_key text not null default 'default',
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id text,
  correlation_id text,
  action text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  source_type text,
  source_id text,
  result text not null check (result in ('SUCCESS', 'DENIED', 'FAILED', 'ROLLED_BACK')),
  reason text,
  before_data jsonb,
  after_data jsonb,
  changes_data jsonb,
  canonical_payload jsonb not null default '{}'::jsonb,
  previous_hash text not null,
  entry_hash text not null,
  key_id text not null,
  occurred_at timestamptz not null default now()
);

alter table public.audit_events
  add column if not exists canonical_payload jsonb not null default '{}'::jsonb;

create unique index if not exists audit_events_tenant_sequence_idx
  on public.audit_events(tenant_key, sequence);

create index if not exists audit_events_occurred_idx
  on public.audit_events(tenant_key, occurred_at desc);

create index if not exists audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, occurred_at desc);

-- The runtime client cannot update or delete audit events.
revoke update, delete on public.audit_events from anon, authenticated;

alter table public.audit_events enable row level security;

drop policy if exists audit_events_admin_read on public.audit_events;
create policy audit_events_admin_read
  on public.audit_events for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

-- The Edge Function uses service_role and inserts through the function below.
revoke insert on public.audit_events from anon, authenticated;

create or replace function public.append_audit_event(
  p_tenant_key text,
  p_event jsonb,
  p_entry_hash text,
  p_key_id text
)
returns public.audit_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_hash text;
  v_row public.audit_events;
begin
  -- Serialize the chain head per tenant to prevent two writers using the same previous hash.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tenant_key, 'default'), 0));

  select entry_hash
    into v_previous_hash
  from public.audit_events
  where tenant_key = coalesce(p_tenant_key, 'default')
  order by sequence desc
  limit 1;

  insert into public.audit_events (
    tenant_key, actor_user_id, request_id, correlation_id,
    action, event_type, entity_type, entity_id, source_type, source_id,
    result, reason, before_data, after_data, changes_data, canonical_payload,
    previous_hash, entry_hash, key_id, occurred_at
  )
  values (
    coalesce(p_tenant_key, 'default'),
    nullif(p_event->>'actor_user_id', '')::uuid,
    p_event->>'request_id',
    p_event->>'correlation_id',
    p_event->>'action',
    p_event->>'event_type',
    p_event->>'entity_type',
    p_event->>'entity_id',
    p_event->>'source_type',
    p_event->>'source_id',
    p_event->>'result',
    p_event->>'reason',
    p_event->'before',
    p_event->'after',
    p_event->'changes',
    p_event,
    coalesce(v_previous_hash, 'GENESIS'),
    p_entry_hash,
    p_key_id,
    coalesce((p_event->>'occurred_at')::timestamptz, now())
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.append_audit_event(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.append_audit_event(text, jsonb, text, text) to service_role;

/* ============================================================
   Archive tables and archive helper
   ============================================================ */
create table if not exists public.audit_events_archive (
  like public.audit_events including all,
  archived_at timestamptz not null default now(),
  archive_batch_id uuid not null default gen_random_uuid()
);
-- Archived rows retain their original sequence; they must not generate a new identity value.
alter table public.audit_events_archive alter column sequence drop identity if exists;

revoke update, delete on public.audit_events_archive from anon, authenticated;
alter table public.audit_events_archive enable row level security;

drop policy if exists audit_events_archive_admin_read on public.audit_events_archive;
create policy audit_events_archive_admin_read
  on public.audit_events_archive for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

-- Run from a protected scheduled job/service role, not from the browser.
create or replace function public.archive_old_audit_events(p_before timestamptz, p_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_count integer;
begin
  with moved as (
    delete from public.audit_events
    where sequence in (
      select sequence
      from public.audit_events
      where occurred_at < p_before
      order by sequence asc
      limit greatest(p_limit, 1)
      for update skip locked
    )
    returning *
  )
  insert into public.audit_events_archive (
    sequence, event_id, tenant_key, actor_user_id, request_id, correlation_id,
    action, event_type, entity_type, entity_id, source_type, source_id,
    result, reason, before_data, after_data, changes_data, canonical_payload,
    previous_hash, entry_hash, key_id, occurred_at, archive_batch_id
  )
  select sequence, event_id, tenant_key, actor_user_id, request_id, correlation_id,
    action, event_type, entity_type, entity_id, source_type, source_id,
    result, reason, before_data, after_data, changes_data, canonical_payload,
    previous_hash, entry_hash, key_id, occurred_at, v_batch
  from moved;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.archive_old_audit_events(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.archive_old_audit_events(timestamptz, integer) to service_role;

/* ============================================================
   Generic updated_at triggers
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

drop trigger if exists production_batches_updated_at on public.production_batches;
create trigger production_batches_updated_at
before update on public.production_batches
for each row execute function public.set_updated_at();

drop trigger if exists return_approval_requests_updated_at on public.return_approval_requests;
create trigger return_approval_requests_updated_at
before update on public.return_approval_requests
for each row execute function public.set_updated_at();

/* ============================================================
   RLS: least privilege for the new tables
   ============================================================ */
alter table public.production_batches enable row level security;
alter table public.production_cost_lines enable row level security;
alter table public.return_approval_requests enable row level security;
alter table public.return_approval_items enable row level security;
alter table public.return_approval_events enable row level security;
alter table public.partner_report_signatures enable row level security;

drop policy if exists production_read on public.production_batches;
create policy production_read
  on public.production_batches for select to authenticated
  using (created_by = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists production_create on public.production_batches;
create policy production_create
  on public.production_batches for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists production_update on public.production_batches;
create policy production_update
  on public.production_batches for update to authenticated
  using (created_by = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com')
  with check (created_by = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists production_cost_read on public.production_cost_lines;
create policy production_cost_read
  on public.production_cost_lines for select to authenticated
  using (exists (
    select 1 from public.production_batches b
    where b.id = production_batch_id
      and (b.created_by = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com')
  ));

drop policy if exists production_cost_create on public.production_cost_lines;
create policy production_cost_create
  on public.production_cost_lines for insert to authenticated
  with check (exists (
    select 1 from public.production_batches b
    where b.id = production_batch_id
      and (b.created_by = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com')
  ));

drop policy if exists return_request_read on public.return_approval_requests;
create policy return_request_read
  on public.return_approval_requests for select to authenticated
  using (requester_id = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists return_request_create on public.return_approval_requests;
create policy return_request_create
  on public.return_approval_requests for insert to authenticated
  with check (requester_id = auth.uid());

drop policy if exists return_request_admin_update on public.return_approval_requests;
create policy return_request_admin_update
  on public.return_approval_requests for update to authenticated
  using ((auth.jwt() ->> 'email') = 'albakaly779@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists return_item_read on public.return_approval_items;
create policy return_item_read
  on public.return_approval_items for select to authenticated
  using (exists (
    select 1 from public.return_approval_requests r
    where r.id = request_id
      and (r.requester_id = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com')
  ));

drop policy if exists return_item_create on public.return_approval_items;
create policy return_item_create
  on public.return_approval_items for insert to authenticated
  with check (exists (
    select 1 from public.return_approval_requests r
    where r.id = request_id and r.requester_id = auth.uid()
  ));

drop policy if exists return_event_read on public.return_approval_events;
create policy return_event_read
  on public.return_approval_events for select to authenticated
  using (actor_id = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists return_event_create on public.return_approval_events;
create policy return_event_create
  on public.return_approval_events for insert to authenticated
  with check (actor_id = auth.uid());

drop policy if exists partner_signature_read on public.partner_report_signatures;
create policy partner_signature_read
  on public.partner_report_signatures for select to authenticated
  using (partner_user_id = auth.uid() or (auth.jwt() ->> 'email') = 'albakaly779@gmail.com');

drop policy if exists partner_signature_create on public.partner_report_signatures;
create policy partner_signature_create
  on public.partner_report_signatures for insert to authenticated
  with check (partner_user_id = auth.uid());

-- No direct update/delete policies are created for approval events or signatures.
