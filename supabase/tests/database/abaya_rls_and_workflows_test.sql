begin;

select plan(54);

-- Every application table must keep RLS enabled.
select ok((select relrowsecurity from pg_class where oid = 'public.app_settings'::regclass), 'RLS enabled: app_settings');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass), 'RLS enabled: audit_events');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_events_archive'::regclass), 'RLS enabled: audit_events_archive');
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), 'RLS enabled: customers');
select ok((select relrowsecurity from pg_class where oid = 'public.discount_rules'::regclass), 'RLS enabled: discount_rules');
select ok((select relrowsecurity from pg_class where oid = 'public.expenses'::regclass), 'RLS enabled: expenses');
select ok((select relrowsecurity from pg_class where oid = 'public.inventory_movements'::regclass), 'RLS enabled: inventory_movements');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_templates'::regclass), 'RLS enabled: invoice_templates');
select ok((select relrowsecurity from pg_class where oid = 'public.invoices'::regclass), 'RLS enabled: invoices');
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'RLS enabled: notifications');
select ok((select relrowsecurity from pg_class where oid = 'public.order_items'::regclass), 'RLS enabled: order_items');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'RLS enabled: orders');
select ok((select relrowsecurity from pg_class where oid = 'public.partner_report_signatures'::regclass), 'RLS enabled: partner_report_signatures');
select ok((select relrowsecurity from pg_class where oid = 'public.partner_reports'::regclass), 'RLS enabled: partner_reports');
select ok((select relrowsecurity from pg_class where oid = 'public.partners_config'::regclass), 'RLS enabled: partners_config');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'RLS enabled: payments');
select ok((select relrowsecurity from pg_class where oid = 'public.production_batches'::regclass), 'RLS enabled: production_batches');
select ok((select relrowsecurity from pg_class where oid = 'public.production_cost_lines'::regclass), 'RLS enabled: production_cost_lines');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'RLS enabled: products');
select ok((select relrowsecurity from pg_class where oid = 'public.rep_commissions'::regclass), 'RLS enabled: rep_commissions');
select ok((select relrowsecurity from pg_class where oid = 'public.return_approval_events'::regclass), 'RLS enabled: return_approval_events');
select ok((select relrowsecurity from pg_class where oid = 'public.return_approval_items'::regclass), 'RLS enabled: return_approval_items');
select ok((select relrowsecurity from pg_class where oid = 'public.return_approval_requests'::regclass), 'RLS enabled: return_approval_requests');
select ok((select relrowsecurity from pg_class where oid = 'public.return_items'::regclass), 'RLS enabled: return_items');
select ok((select relrowsecurity from pg_class where oid = 'public.returns'::regclass), 'RLS enabled: returns');
select ok((select relrowsecurity from pg_class where oid = 'public.sales_reps'::regclass), 'RLS enabled: sales_reps');
select ok((select relrowsecurity from pg_class where oid = 'public.supplier_transactions'::regclass), 'RLS enabled: supplier_transactions');
select ok((select relrowsecurity from pg_class where oid = 'public.suppliers'::regclass), 'RLS enabled: suppliers');
select ok((select relrowsecurity from pg_class where oid = 'public.user_activity_logs'::regclass), 'RLS enabled: user_activity_logs');
select ok((select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass), 'RLS enabled: user_profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), 'RLS enabled: user_roles');

-- Authorization helpers and atomic workflows must exist with server-side execution.
select ok(to_regprocedure('private.has_any_role(text[])') is not null, 'role helper exists');
select ok(to_regprocedure('private.is_admin()') is not null, 'admin helper exists');
select ok((select prosecdef from pg_proc where oid = 'public.decrement_stock(text,numeric)'::regprocedure), 'stock decrement is SECURITY DEFINER');
select ok(to_regprocedure('public.create_order_with_stock(uuid,text,jsonb,numeric,numeric,text)') is not null, 'atomic order workflow exists');
select ok(to_regprocedure('public.record_payment_atomic(uuid,numeric,text,text)') is not null, 'atomic payment workflow exists');

-- Append-only audit table and partner reports must not be writable from the browser.
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), 'authenticated cannot update audit_events');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'DELETE'), 'authenticated cannot delete audit_events');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_admin_read'), 'admin audit read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_admin_insert'), 'admin role insert policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_admin_update'), 'admin role update policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_admin_delete'), 'admin role delete policy exists');
select ok(not has_table_privilege('authenticated', 'public.partner_reports', 'INSERT'), 'authenticated cannot insert partner_reports');
select ok(not has_table_privilege('authenticated', 'public.partner_reports', 'UPDATE'), 'authenticated cannot update partner_reports');
select ok(not has_table_privilege('authenticated', 'public.partner_reports', 'DELETE'), 'authenticated cannot delete partner_reports');

-- Storage buckets and owner/admin policies must be present.
select ok(exists (select 1 from storage.buckets where id = 'branding'), 'branding bucket exists');
select ok(exists (select 1 from storage.buckets where id = 'product-images'), 'product-images bucket exists');
select ok(exists (select 1 from storage.buckets where id = 'user-files'), 'user-files bucket exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_files_owner_write'), 'user files owner policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_admin_write'), 'branding admin policy exists');

-- Generated cost calculations and mandatory audit/approval fields.
select ok(exists (select 1 from pg_attribute where attrelid = 'public.production_batches'::regclass and attname = 'total_cost' and attgenerated = 's'), 'production total_cost is generated');
select ok(exists (select 1 from pg_attribute where attrelid = 'public.production_batches'::regclass and attname = 'unit_cost' and attgenerated = 's'), 'production unit_cost is generated');
select ok((select attnotnull from pg_attribute where attrelid = 'public.return_approval_requests'::regclass and attname = 'reason_details'), 'return reason is mandatory');
select ok((select attnotnull from pg_attribute where attrelid = 'public.audit_events'::regclass and attname = 'previous_hash'), 'audit previous_hash is mandatory');

select * from finish();
rollback;
