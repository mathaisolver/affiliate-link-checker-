-- === AFFILIATE LINK CHECKER — UPDATED SQL SCHEMA ===
-- Run this in Supabase SQL Editor (replaces any earlier version).
--
-- Changes vs previous version:
-- 1. profiles table now has a "name" column
-- 2. Auto-create profile trigger stores the user's name from auth.users.raw_user_meta_data

-- === USERS PROFILE TABLE ===
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  -- 'free' = signed up, 3 searches per day
  -- 'pro'  = paid $9, unlimited lifetime
  lifetime_unlocked boolean not null default false,
  lifetime_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === USAGE TRACKING TABLE ===
create table if not exists public.usage_tracking (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_id text,
  ip_hash text,
  url_checked text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_tracking_user_created_idx
  on public.usage_tracking (user_id, created_at desc);
create index if not exists usage_tracking_anon_created_idx
  on public.usage_tracking (anonymous_id, created_at desc);
create index if not exists usage_tracking_ip_created_idx
  on public.usage_tracking (ip_hash, created_at desc);

-- === PAYMENTS TABLE ===
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  amount numeric not null default 9.00,
  currency text not null default 'USD',
  provider text not null default 'lemonsqueezy',
  provider_order_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (provider, provider_order_id)
);

-- === BULK CHECK RESULTS ===
create table if not exists public.bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  urls jsonb not null,
  results jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- === AUTO-CREATE PROFILE ON SIGNUP (with name) ===
-- Updated to also store the user's name from raw_user_meta_data (set when
-- they sign up with the `data: { name: ... }` option).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, public.profiles.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === UPDATED_AT TRIGGER ===
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- === ROW LEVEL SECURITY ===
alter table public.profiles enable row level security;
alter table public.usage_tracking enable row level security;
alter table public.payments enable row level security;
alter table public.bulk_jobs enable row level security;

-- Profiles: users can read/update only their own row
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Usage tracking
drop policy if exists "Users can read own usage" on public.usage_tracking;
create policy "Users can read own usage"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

-- Payments
drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Bulk jobs
drop policy if exists "Users can CRUD own bulk jobs" on public.bulk_jobs;
create policy "Users can CRUD own bulk jobs"
  on public.bulk_jobs for all
  using (auth.uid() = user_id);

-- Allow any authenticated user to insert their own usage
drop policy if exists "Users can insert own usage" on public.usage_tracking;
create policy "Users can insert own usage"
  on public.usage_tracking for insert
  with check (auth.uid() = user_id);
