-- Run this in Supabase SQL Editor after creating users in Authentication > Users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email,
    updated_at = now()
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

alter table public.profiles enable row level security;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'admin')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Replace these values with the Auth user UUIDs shown in the Supabase dashboard.
-- The first account has the highest authorization level.
-- insert into public.profiles (id, full_name, role)
-- values ('SUPERADMIN_AUTH_USER_UUID', 'Church Superadmin', 'superadmin');
-- insert into public.profiles (id, full_name, role)
-- values ('ADMIN_AUTH_USER_UUID', 'Church Admin', 'admin');