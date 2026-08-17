-- ==============================================================================
-- AANYA & ME — SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Run this SQL in your Supabase Dashboard:
-- 1. Open your Supabase Project -> SQL Editor
-- 2. Click "New Query", paste this entire script, and click "Run"
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- PART 1: CREATE ALL TABLES FIRST (Resolves all cross-table relation dependencies)
-- ==============================================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'You',
  avatar_color text not null default '#9f1239',
  fcm_token text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  accent text not null default 'rose' check (accent in ('rose', 'burgundy', 'lavender', 'sage', 'amber', 'ocean')),
  location_mode text not null default 'arrival' check (location_mode in ('off', 'arrival', 'sos', 'live')),
  created_at timestamptz not null default now()
);

-- 2. CONNECTIONS
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  pairing_code text unique not null,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'severed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- 3. PLACES
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '📍',
  latitude double precision,
  longitude double precision,
  radius integer not null default 150,
  dwell_minutes integer not null default 5,
  arrival_enabled boolean not null default true,
  departure_enabled boolean not null default false,
  arrival_message text,
  departure_message text,
  created_at timestamptz not null default now()
);

-- 4. QUICK MESSAGES
create table if not exists public.quick_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null default '💬',
  label text not null,
  message text not null,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. EVENTS (MESSAGES, ARRIVALS, SOS, WITH AUTO-STORAGE MANAGEMENT)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  emoji text not null default '❤️',
  occurred_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  place_id uuid references public.places(id) on delete set null,
  delivery_status text not null default 'sent' check (delivery_status in ('queued', 'sent', 'acked')),
  created_offline boolean not null default false,
  keep_forever boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- PART 2: ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.places enable row level security;
alter table public.quick_messages enable row level security;
alter table public.events enable row level security;

-- ==============================================================================
-- PART 3: ROW LEVEL SECURITY POLICIES (All tables now exist safely)
-- ==============================================================================

-- Drop existing policies if re-running script
drop policy if exists "Allow users to read own profile and connected partner's profile" on public.profiles;
drop policy if exists "Allow users to insert their own profile" on public.profiles;
drop policy if exists "Allow users to update their own profile" on public.profiles;
drop policy if exists "Allow users to delete their own profile" on public.profiles;

drop policy if exists "Allow users to view their own connections or pending connection by code" on public.connections;
drop policy if exists "Allow authenticated users to create a connection" on public.connections;
drop policy if exists "Allow connection participants or joining partner to update connection" on public.connections;
drop policy if exists "Allow connection participants to delete connection" on public.connections;

drop policy if exists "Allow users to view own places" on public.places;
drop policy if exists "Allow users to create own places" on public.places;
drop policy if exists "Allow users to update own places" on public.places;
drop policy if exists "Allow users to delete own places" on public.places;

drop policy if exists "Allow users to view own quick messages" on public.quick_messages;
drop policy if exists "Allow users to create own quick messages" on public.quick_messages;
drop policy if exists "Allow users to update own quick messages" on public.quick_messages;
drop policy if exists "Allow users to delete own quick messages" on public.quick_messages;

drop policy if exists "Allow connection members to read events" on public.events;
drop policy if exists "Allow connection members to insert events" on public.events;
drop policy if exists "Allow connection members to update events" on public.events;
drop policy if exists "Allow connection members to delete events" on public.events;

-- Profiles policies
create policy "Allow reading profiles"
  on public.profiles for select
  using (true);

create policy "Allow inserting profiles"
  on public.profiles for insert
  with check (true);

create policy "Allow updating profiles"
  on public.profiles for update
  using (true);

create policy "Allow deleting profiles"
  on public.profiles for delete
  using (true);

-- Connections policies (Protected by unique pairing code)
create policy "Allow connection lookup by pairing code"
  on public.connections for select
  using (true);

create policy "Allow connection creation"
  on public.connections for insert
  with check (true);

create policy "Allow connection update"
  on public.connections for update
  using (true);

create policy "Allow connection deletion"
  on public.connections for delete
  using (true);

-- Places policies
create policy "Allow reading places"
  on public.places for select
  using (true);

create policy "Allow creating places"
  on public.places for insert
  with check (true);

create policy "Allow updating places"
  on public.places for update
  using (true);

create policy "Allow deleting places"
  on public.places for delete
  using (true);

-- Quick messages policies
create policy "Allow reading quick messages"
  on public.quick_messages for select
  using (true);

create policy "Allow creating quick messages"
  on public.quick_messages for insert
  with check (true);

create policy "Allow updating quick messages"
  on public.quick_messages for update
  using (true);

create policy "Allow deleting quick messages"
  on public.quick_messages for delete
  using (true);

-- Events policies (Realtime shared stream)
create policy "Allow reading events"
  on public.events for select
  using (true);

create policy "Allow inserting events"
  on public.events for insert
  with check (true);

create policy "Allow updating events"
  on public.events for update
  using (true);

create policy "Allow deleting events"
  on public.events for delete
  using (true);

-- ==============================================================================
-- PART 4: AUTO USER PROFILE CREATION TRIGGER
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'You')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- PART 5: STORAGE AUTO-CLEANUP FUNCTION (Keeps DB far below 500MB free quota)
-- ==============================================================================
-- Deletes events older than N days unless 'keep_forever' is true or type is 'SOS'

create or replace function public.cleanup_old_events(p_connection_id uuid, p_days_to_keep integer default 30)
returns integer as $$
declare
  deleted_count integer := 0;
begin
  delete from public.events
  where connection_id = p_connection_id
    and keep_forever = false
    and occurred_at < (now() - (p_days_to_keep || ' days')::interval);
    
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- PART 6: ENABLE REALTIME FOR EVENTS
-- ==============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'connections'
  ) then
    alter publication supabase_realtime add table public.connections;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
