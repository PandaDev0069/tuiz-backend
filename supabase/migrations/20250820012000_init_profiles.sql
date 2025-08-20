-- Enable UUID + security extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- A dedicated app schema
create schema if not exists app;

-- Profiles table: 1-to-1 with auth.users
create table if not exists app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (length(username) >= 3) ,
  display_name text,
  avatar_url text,
  role text not null default 'user', -- 'user' | 'admin'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated on app.profiles;
create trigger trg_profiles_updated
before update on app.profiles
for each row execute function app.touch_updated_at();

-- RLS ON
alter table app.profiles enable row level security;

-- Policies: users can see everyone (for leaderboards later), but only edit self
create policy "profiles_select_public"
on app.profiles for select
to authenticated
using (true);

create policy "profiles_insert_self"
on app.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_self"
on app.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Helper: create profile row after signup
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into app.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'New Player'))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();