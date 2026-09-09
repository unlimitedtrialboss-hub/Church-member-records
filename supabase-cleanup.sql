-- The application uses public.members for member records and public.profiles
-- for Supabase Auth roles. The following legacy tables were empty when audited.
drop table if exists public.member_children;
drop table if exists public.church_members;
drop table if exists public.user_roles;