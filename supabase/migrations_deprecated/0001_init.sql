-- PengStays / Afrispace Stay Book — Supabase schema
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles  (extends auth.users with app-specific fields)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  whatsapp_number text,
  plan text,
  subscription_active boolean not null default false,
  subscription_expires date,
  created_date timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up. The listed
-- admin email always gets the admin role; everyone else starts as 'user'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when new.email = 'samuelivere92@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  title text not null,
  description text,
  category text not null check (category in ('sale', 'rent', 'shortlet', 'hotel', 'land')),
  price numeric not null,
  price_period text not null default 'total' check (price_period in ('total', 'per_year', 'per_month', 'per_night')),
  country text not null,
  state text,
  city text,
  bedrooms integer,
  bathrooms integer,
  images text[] not null default '{}',
  whatsapp_number text,
  owner_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  featured boolean not null default false,
  featured_expires date
);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_created_by_idx on public.listings(created_by_id);

-- ---------------------------------------------------------------------
-- agent_profiles
-- ---------------------------------------------------------------------
create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  user_id uuid not null,
  display_name text not null,
  agency_name text,
  bio text,
  photo_url text,
  whatsapp_number text,
  user_email text
);
create index if not exists agent_profiles_user_id_idx on public.agent_profiles(user_id);

-- ---------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  plan text not null check (plan in ('sale_rent', 'shortlet', 'hotel', 'land', 'feature')),
  amount numeric not null,
  tx_ref text not null unique,
  flw_transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'failed')),
  expires_date date,
  user_email text,
  listing_id uuid references public.listings(id) on delete set null
);
create index if not exists subscriptions_tx_ref_idx on public.subscriptions(tx_ref);

-- ---------------------------------------------------------------------
-- page_views
-- ---------------------------------------------------------------------
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  path text not null,
  day text not null,
  visitor_id text not null,
  session_id text,
  referrer text
);
create index if not exists page_views_day_idx on public.page_views(day);

-- ---------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  listing_id uuid references public.listings(id) on delete cascade,
  listing_title text,
  to_user_id uuid,
  sender_name text,
  sender_contact text,
  content text not null,
  read boolean not null default false
);
create index if not exists messages_to_user_idx on public.messages(to_user_id);

-- ---------------------------------------------------------------------
-- booking_requests
-- ---------------------------------------------------------------------
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  listing_id uuid references public.listings(id) on delete cascade,
  listing_title text,
  to_user_id uuid,
  name text,
  contact text,
  type text not null check (type in ('inspection', 'booking')),
  start_date date,
  end_date date,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  amount numeric,
  tx_ref text,
  flw_transaction_id text,
  paid boolean not null default false
);
create index if not exists booking_requests_to_user_idx on public.booking_requests(to_user_id);
create index if not exists booking_requests_tx_ref_idx on public.booking_requests(tx_ref);

-- ---------------------------------------------------------------------
-- ads  (admin-managed promotional banners shown on the homepage)
-- ---------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  title text not null,
  subtitle text,
  image_url text,
  link_url text,
  active boolean not null default true,
  sort_order integer not null default 0
);

-- =======================================================================
-- Row Level Security
-- =======================================================================
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.page_views enable row level security;
alter table public.messages enable row level security;
alter table public.booking_requests enable row level security;
alter table public.ads enable row level security;

-- profiles: users manage their own row; admins see/manage all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_upsert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- listings: approved listings are public; owners/admins see everything
create policy "listings_select" on public.listings
  for select using (status = 'approved' or created_by_id = auth.uid() or public.is_admin());
create policy "listings_insert" on public.listings
  for insert with check (created_by_id = auth.uid());
create policy "listings_update" on public.listings
  for update using (created_by_id = auth.uid() or public.is_admin());
create policy "listings_delete" on public.listings
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- agent_profiles: public read (they're shown on public agent pages)
create policy "agent_profiles_select" on public.agent_profiles
  for select using (true);
create policy "agent_profiles_insert" on public.agent_profiles
  for insert with check (created_by_id = auth.uid());
create policy "agent_profiles_update" on public.agent_profiles
  for update using (created_by_id = auth.uid() or public.is_admin());
create policy "agent_profiles_delete" on public.agent_profiles
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- subscriptions: users can read their own; only admins (and the service-role
-- Edge Function, which bypasses RLS) can write
create policy "subscriptions_select" on public.subscriptions
  for select using (created_by_id = auth.uid() or public.is_admin());
create policy "subscriptions_admin_write" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- page_views: anyone (including anonymous visitors) can log a view;
-- only admins can read/aggregate them
create policy "page_views_insert_public" on public.page_views
  for insert with check (true);
create policy "page_views_select_admin" on public.page_views
  for select using (public.is_admin());

-- messages: sender and recipient (and admins) can see/manage a thread.
-- Anonymous visitors can message a listing owner too — created_by_id is
-- simply null for guest-submitted messages (no account required to chat).
create policy "messages_select" on public.messages
  for select using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());
create policy "messages_insert" on public.messages
  for insert with check (created_by_id = auth.uid() or created_by_id is null);
create policy "messages_update" on public.messages
  for update using (to_user_id = auth.uid() or public.is_admin());
create policy "messages_delete" on public.messages
  for delete using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());

-- booking_requests: same shape as messages — guests can request a
-- booking/inspection without signing up (paying online still requires login).
create policy "booking_requests_select" on public.booking_requests
  for select using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());
create policy "booking_requests_insert" on public.booking_requests
  for insert with check (created_by_id = auth.uid() or created_by_id is null);
create policy "booking_requests_update" on public.booking_requests
  for update using (to_user_id = auth.uid() or public.is_admin());
create policy "booking_requests_delete" on public.booking_requests
  for delete using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());

-- ads: anyone can read active ads (shown on the public homepage);
-- only the admin can create/update/delete them
create policy "ads_select_active_or_admin" on public.ads
  for select using (active = true or public.is_admin());
create policy "ads_admin_write" on public.ads
  for all using (public.is_admin()) with check (public.is_admin());

-- =======================================================================
-- Storage: public "uploads" bucket for listing photos & agent avatars
-- =======================================================================
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "uploads_public_read" on storage.objects
  for select using (bucket_id = 'uploads');
create policy "uploads_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
create policy "uploads_owner_update" on storage.objects
  for update to authenticated using (bucket_id = 'uploads' and owner = auth.uid());
create policy "uploads_owner_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and owner = auth.uid());

-- =======================================================================
-- Realtime: power the live "visitors online" panel in /admin
-- =======================================================================
alter publication supabase_realtime add table public.page_views;
