-- Keep the database role constraint compatible with the roles used by the existing UI.
alter table public.user_profiles drop constraint if exists user_profiles_assigned_role_check;
alter table public.user_profiles add constraint user_profiles_assigned_role_check
  check (assigned_role in ('super_admin','general_manager','operations_manager','production','support','rep','partner','branch_manager','accountant','marketer'));

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('super_admin','general_manager','operations_manager','production','support','rep','partner','branch_manager','accountant','marketer'));
