-- AbayaRidaa security hardening after Supabase advisor review.
-- Do not put credentials in migrations.

-- Trigger-only function: it must not be callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Prevent search_path manipulation for trigger functions.
alter function public.set_updated_at() set search_path = public, pg_temp;

-- A legacy helper may exist in older environments; keep it private if present.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Use the centralized authorization function instead of an exposed admin email.
drop policy if exists audit_events_admin_read on public.audit_events;
create policy audit_events_admin_read
  on public.audit_events for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists audit_events_archive_admin_read on public.audit_events_archive;
create policy audit_events_archive_admin_read
  on public.audit_events_archive for select
  to authenticated
  using ((select private.is_admin()));

-- Keep append-only audit tables non-writable by browser roles.
revoke insert, update, delete, truncate, references, trigger
  on public.audit_events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.audit_events_archive from anon, authenticated;
