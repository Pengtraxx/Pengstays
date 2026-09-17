-- =======================================================================
-- PengStays — FULL SCHEMA RESET
-- =======================================================================
-- Run this ONE file in the Supabase SQL Editor (or `psql "$(supabase db url)"
-- -f supabase/schema_full_reset.sql`) to get a clean, known-good database —
-- replaces 0001_init.sql + 0002_da_bros.sql + seed_hotels.sql combined.
--
-- WARNING: THIS DROPS AND RECREATES every PengStays table (listings,
-- profiles, bookings, messages, ads, Da Bros — everything below). Anything
-- you've since added by hand in the dashboard will be lost. Auth users
-- themselves (auth.users) are NOT touched — only the public.* app tables.
--
-- Safe to re-run any time: every statement either drops-then-recreates or
-- uses IF NOT EXISTS / IF EXISTS, so running this twice in a row won't error.
-- =======================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------
-- 0. Clean slate
-- -----------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.bros_messages cascade;
drop table if exists public.bros_subscriptions cascade;
drop table if exists public.bros_listings cascade;
drop table if exists public.ads cascade;
drop table if exists public.booking_requests cascade;
drop table if exists public.messages cascade;
drop table if exists public.page_views cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.agent_profiles cascade;
drop table if exists public.listings cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.has_active_bros_subscription() cascade;

-- -----------------------------------------------------------------------
-- 1. profiles  (extends auth.users with app-specific fields)
-- -----------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  whatsapp_number text,
  plan text,
  subscription_active boolean not null default false,
  subscription_expires date,
  bros_subscription_active boolean not null default false,
  bros_subscription_expires date,
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

-- Used to gate Da Bros: viewing, posting, and chatting all require this.
create or replace function public.has_active_bros_subscription()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select bros_subscription_active and bros_subscription_expires >= current_date
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------
-- 2. listings
-- -----------------------------------------------------------------------
create table public.listings (
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
create index listings_status_idx on public.listings(status);
create index listings_created_by_idx on public.listings(created_by_id);

-- -----------------------------------------------------------------------
-- 3. agent_profiles
-- -----------------------------------------------------------------------
create table public.agent_profiles (
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
create index agent_profiles_user_id_idx on public.agent_profiles(user_id);

-- -----------------------------------------------------------------------
-- 4. subscriptions  (seller plans: sale_rent / shortlet / hotel / land / feature)
-- -----------------------------------------------------------------------
create table public.subscriptions (
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
create index subscriptions_tx_ref_idx on public.subscriptions(tx_ref);

-- -----------------------------------------------------------------------
-- 5. page_views
-- -----------------------------------------------------------------------
create table public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now(),
  path text not null,
  day text not null,
  visitor_id text not null,
  session_id text,
  referrer text
);
create index page_views_day_idx on public.page_views(day);

-- -----------------------------------------------------------------------
-- 6. messages  (listing inquiries — guests can send these too)
-- -----------------------------------------------------------------------
create table public.messages (
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
create index messages_to_user_idx on public.messages(to_user_id);

-- -----------------------------------------------------------------------
-- 7. booking_requests  (bookings/inspections — guests can request AND pay)
-- -----------------------------------------------------------------------
create table public.booking_requests (
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
create index booking_requests_to_user_idx on public.booking_requests(to_user_id);
create index booking_requests_tx_ref_idx on public.booking_requests(tx_ref);

-- -----------------------------------------------------------------------
-- 8. ads  (admin-managed homepage promo banners)
-- -----------------------------------------------------------------------
create table public.ads (
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

-- -----------------------------------------------------------------------
-- 9. Da Bros — peer marketplace, fully gated behind a paid ₦20,000 / 14-day
--    subscription (viewing, posting, and chatting all require it). Guests
--    can pay for access before they have an account — the payment is
--    matched to them by email (payer_email) once they register/log in
--    with that same email (see the "claim" policy below).
-- -----------------------------------------------------------------------
create table public.bros_listings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  title text not null,
  description text,
  price numeric,
  images text[] not null default '{}',
  whatsapp_number text,
  status text not null default 'active' check (status in ('active', 'expired', 'removed')),
  expires_date date not null default (current_date + interval '14 days')
);
create index bros_listings_created_by_idx on public.bros_listings(created_by_id);
create index bros_listings_status_idx on public.bros_listings(status);

create table public.bros_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete set null,
  payer_email text,
  created_date timestamptz not null default now(),
  amount numeric not null default 20000,
  tx_ref text not null unique,
  flw_transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  period_start date,
  period_end date
);
create index bros_subscriptions_created_by_idx on public.bros_subscriptions(created_by_id);
create index bros_subscriptions_payer_email_idx on public.bros_subscriptions(payer_email);

create table public.bros_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  listing_id uuid not null references public.bros_listings(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read boolean not null default false
);
create index bros_messages_listing_idx on public.bros_messages(listing_id);
create index bros_messages_to_user_idx on public.bros_messages(to_user_id);

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
alter table public.bros_listings enable row level security;
alter table public.bros_subscriptions enable row level security;
alter table public.bros_messages enable row level security;

-- profiles: users manage their own row; admins see/manage all
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own" on public.profiles
  for insert with check (id = auth.uid());
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- listings: approved listings are public (guests included); owners/admins see everything
drop policy if exists "listings_select" on public.listings;
create policy "listings_select" on public.listings
  for select using (status = 'approved' or created_by_id = auth.uid() or public.is_admin());
drop policy if exists "listings_insert" on public.listings;
create policy "listings_insert" on public.listings
  for insert with check (created_by_id = auth.uid());
drop policy if exists "listings_update" on public.listings;
create policy "listings_update" on public.listings
  for update using (created_by_id = auth.uid() or public.is_admin());
drop policy if exists "listings_delete" on public.listings;
create policy "listings_delete" on public.listings
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- agent_profiles: public read (shown on public agent pages)
drop policy if exists "agent_profiles_select" on public.agent_profiles;
create policy "agent_profiles_select" on public.agent_profiles
  for select using (true);
drop policy if exists "agent_profiles_insert" on public.agent_profiles;
create policy "agent_profiles_insert" on public.agent_profiles
  for insert with check (created_by_id = auth.uid());
drop policy if exists "agent_profiles_update" on public.agent_profiles;
create policy "agent_profiles_update" on public.agent_profiles
  for update using (created_by_id = auth.uid() or public.is_admin());
drop policy if exists "agent_profiles_delete" on public.agent_profiles;
create policy "agent_profiles_delete" on public.agent_profiles
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- subscriptions: users can read their own; only admins (and the
-- service-role Edge Function, which bypasses RLS) can write
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select using (created_by_id = auth.uid() or public.is_admin());
drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- page_views: anyone (including anonymous visitors) can log a view;
-- only admins can read/aggregate them
drop policy if exists "page_views_insert_public" on public.page_views;
create policy "page_views_insert_public" on public.page_views
  for insert with check (true);
drop policy if exists "page_views_select_admin" on public.page_views;
create policy "page_views_select_admin" on public.page_views
  for select using (public.is_admin());

-- messages: sender and recipient (and admins) can see/manage a thread.
-- Anonymous visitors can message a listing owner too — created_by_id is
-- simply null for guest-submitted messages (no account required to chat).
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (created_by_id = auth.uid() or created_by_id is null);
drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages
  for update using (to_user_id = auth.uid() or public.is_admin());
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());

-- booking_requests: same shape as messages — guests can request AND pay for
-- a booking/inspection without ever signing up (the payment itself is
-- handled by the flutterwave Edge Function's service-role client, which
-- bypasses RLS, so no extra policy is needed for the paid path).
drop policy if exists "booking_requests_select" on public.booking_requests;
create policy "booking_requests_select" on public.booking_requests
  for select using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());
drop policy if exists "booking_requests_insert" on public.booking_requests;
create policy "booking_requests_insert" on public.booking_requests
  for insert with check (created_by_id = auth.uid() or created_by_id is null);
drop policy if exists "booking_requests_update" on public.booking_requests;
create policy "booking_requests_update" on public.booking_requests
  for update using (to_user_id = auth.uid() or public.is_admin());
drop policy if exists "booking_requests_delete" on public.booking_requests;
create policy "booking_requests_delete" on public.booking_requests
  for delete using (to_user_id = auth.uid() or created_by_id = auth.uid() or public.is_admin());

-- ads: anyone can read active ads (shown on the public homepage);
-- only the admin can create/update/delete them
drop policy if exists "ads_select_active_or_admin" on public.ads;
create policy "ads_select_active_or_admin" on public.ads
  for select using (active = true or public.is_admin());
drop policy if exists "ads_admin_write" on public.ads;
create policy "ads_admin_write" on public.ads
  for all using (public.is_admin()) with check (public.is_admin());

-- bros_listings: only paid Da Bros members (or the admin) can view or post.
drop policy if exists "bros_listings_select" on public.bros_listings;
create policy "bros_listings_select" on public.bros_listings
  for select using (
    public.is_admin()
    or (public.has_active_bros_subscription() and (status = 'active' or created_by_id = auth.uid()))
  );
drop policy if exists "bros_listings_insert" on public.bros_listings;
create policy "bros_listings_insert" on public.bros_listings
  for insert with check (created_by_id = auth.uid() and public.has_active_bros_subscription());
drop policy if exists "bros_listings_update" on public.bros_listings;
create policy "bros_listings_update" on public.bros_listings
  for update using (created_by_id = auth.uid() or public.is_admin());
drop policy if exists "bros_listings_delete" on public.bros_listings;
create policy "bros_listings_delete" on public.bros_listings
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- bros_subscriptions: users see their own; only admins/service-role write.
drop policy if exists "bros_subscriptions_select" on public.bros_subscriptions;
create policy "bros_subscriptions_select" on public.bros_subscriptions
  for select using (created_by_id = auth.uid() or public.is_admin());
drop policy if exists "bros_subscriptions_admin_write" on public.bros_subscriptions;
create policy "bros_subscriptions_admin_write" on public.bros_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());
-- Lets a user who just registered/logged in "claim" a Da Bros payment they
-- made as a guest before they had an account — matched by email, and only
-- while it's still unclaimed (created_by_id is null).
drop policy if exists "bros_subscriptions_claim" on public.bros_subscriptions;
create policy "bros_subscriptions_claim" on public.bros_subscriptions
  for update using (payer_email = auth.jwt() ->> 'email' and created_by_id is null)
  with check (created_by_id = auth.uid());

-- bros_messages: only the two participants (or admin) can read a thread;
-- sending a new message requires an active Da Bros subscription.
drop policy if exists "bros_messages_select" on public.bros_messages;
create policy "bros_messages_select" on public.bros_messages
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_admin());
drop policy if exists "bros_messages_insert" on public.bros_messages;
create policy "bros_messages_insert" on public.bros_messages
  for insert with check (from_user_id = auth.uid() and public.has_active_bros_subscription());
drop policy if exists "bros_messages_update" on public.bros_messages;
create policy "bros_messages_update" on public.bros_messages
  for update using (to_user_id = auth.uid() or public.is_admin());

-- =======================================================================
-- Storage: public "uploads" bucket for listing photos, Da Bros photos, etc.
-- =======================================================================
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read" on storage.objects
  for select using (bucket_id = 'uploads');
drop policy if exists "uploads_authenticated_insert" on storage.objects;
create policy "uploads_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
drop policy if exists "uploads_owner_update" on storage.objects;
create policy "uploads_owner_update" on storage.objects
  for update to authenticated using (bucket_id = 'uploads' and owner = auth.uid());
drop policy if exists "uploads_owner_delete" on storage.objects;
create policy "uploads_owner_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and owner = auth.uid());

-- =======================================================================
-- Realtime: live admin analytics + Da Bros in-app chat
-- =======================================================================
do $$ begin
  alter publication supabase_realtime add table public.page_views;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.bros_messages;
exception when duplicate_object then null;
end $$;

-- =======================================================================
-- Starter hotel catalog — 62 listings (Nigeria: all 36 states + FCT,
-- Africa: 25 flagship hotels). These are indicative placeholder prices,
-- NOT a live Booking.com feed — each description says so, and you can edit
-- any of them from /admin once you confirm real rates.
-- =======================================================================
insert into public.listings
  (title, description, category, price, price_period, country, state, city, bedrooms, bathrooms, images, whatsapp_number, owner_email, status, featured)
values
  ('Eko Hotel & Suites, Victoria Island', 'Eko Hotel & Suites is one of Lagos''s best-known hotels, located in Victoria Island. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 165000, 'per_night', 'Nigeria', 'Lagos', 'Victoria Island', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Transcorp Hilton Abuja, Maitama', 'Transcorp Hilton Abuja is one of FCT Abuja''s best-known hotels, located in Maitama. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 190000, 'per_night', 'Nigeria', 'FCT Abuja', 'Maitama', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Golden Tulip Port Harcourt, GRA Phase 2', 'Golden Tulip Port Harcourt is one of Rivers''s best-known hotels, located in GRA Phase 2. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 95000, 'per_night', 'Nigeria', 'Rivers', 'GRA Phase 2', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Tahir Guest Palace, Nassarawa GRA', 'Tahir Guest Palace is one of Kano''s best-known hotels, located in Nassarawa GRA. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 60000, 'per_night', 'Nigeria', 'Kano', 'Nassarawa GRA', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Premier Hotel, Mokola', 'Premier Hotel is one of Oyo''s best-known hotels, located in Mokola. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 48000, 'per_night', 'Nigeria', 'Oyo', 'Mokola', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kaduna Guest Palace Hotel, Kaduna Central', 'Kaduna Guest Palace Hotel is one of Kaduna''s best-known hotels, located in Kaduna Central. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 42000, 'per_night', 'Nigeria', 'Kaduna', 'Kaduna Central', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Le Meridien Ibom Hotel & Golf Resort, Uyo', 'Le Meridien Ibom Hotel & Golf Resort is one of Akwa Ibom''s best-known hotels, located in Uyo. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 120000, 'per_night', 'Nigeria', 'Akwa Ibom', 'Uyo', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Cross Point Hotel, Amawbia', 'Cross Point Hotel is one of Anambra''s best-known hotels, located in Amawbia. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 38000, 'per_night', 'Nigeria', 'Anambra', 'Amawbia', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Zaranda Hotel, Bauchi', 'Zaranda Hotel is one of Bauchi''s best-known hotels, located in Bauchi. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 32000, 'per_night', 'Nigeria', 'Bauchi', 'Bauchi', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Aridolf Resort & Spa, Yenagoa', 'Aridolf Resort & Spa is one of Bayelsa''s best-known hotels, located in Yenagoa. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 45000, 'per_night', 'Nigeria', 'Bayelsa', 'Yenagoa', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Ashi Kene Hotel, Makurdi', 'Ashi Kene Hotel is one of Benue''s best-known hotels, located in Makurdi. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 30000, 'per_night', 'Nigeria', 'Benue', 'Makurdi', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Maiduguri International Hotel, Maiduguri', 'Maiduguri International Hotel is one of Borno''s best-known hotels, located in Maiduguri. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 28000, 'per_night', 'Nigeria', 'Borno', 'Maiduguri', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Transcorp Hotels Calabar, Murtala Mohammed Highway', 'Transcorp Hotels Calabar is one of Cross River''s best-known hotels, located in Murtala Mohammed Highway. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 85000, 'per_night', 'Nigeria', 'Cross River', 'Murtala Mohammed Highway', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Grand Hotel, Asaba', 'Grand Hotel is one of Delta''s best-known hotels, located in Asaba. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 55000, 'per_night', 'Nigeria', 'Delta', 'Asaba', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Halogen Hotel, Abakaliki', 'Halogen Hotel is one of Ebonyi''s best-known hotels, located in Abakaliki. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 26000, 'per_night', 'Nigeria', 'Ebonyi', 'Abakaliki', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Protea Hotel by Marriott Benin City, Reservation Road', 'Protea Hotel by Marriott Benin City is one of Edo''s best-known hotels, located in Reservation Road. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 65000, 'per_night', 'Nigeria', 'Edo', 'Reservation Road', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Fountain Hotels, Ado-Ekiti', 'Fountain Hotels is one of Ekiti''s best-known hotels, located in Ado-Ekiti. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 30000, 'per_night', 'Nigeria', 'Ekiti', 'Ado-Ekiti', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Presidential Hotel, Enugu', 'Presidential Hotel is one of Enugu''s best-known hotels, located in Enugu. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 50000, 'per_night', 'Nigeria', 'Enugu', 'Enugu', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Family Support Hotel & Suites, Gombe', 'Family Support Hotel & Suites is one of Gombe''s best-known hotels, located in Gombe. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 27000, 'per_night', 'Nigeria', 'Gombe', 'Gombe', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Concorde Hotel, Owerri', 'Concorde Hotel is one of Imo''s best-known hotels, located in Owerri. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 55000, 'per_night', 'Nigeria', 'Imo', 'Owerri', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Dutse International Hotel, Dutse', 'Dutse International Hotel is one of Jigawa''s best-known hotels, located in Dutse. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 24000, 'per_night', 'Nigeria', 'Jigawa', 'Dutse', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Grand Ivory Hotel, Katsina', 'Grand Ivory Hotel is one of Katsina''s best-known hotels, located in Katsina. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 28000, 'per_night', 'Nigeria', 'Katsina', 'Katsina', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kebbi Guest Inn, Birnin Kebbi', 'Kebbi Guest Inn is one of Kebbi''s best-known hotels, located in Birnin Kebbi. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 24000, 'per_night', 'Nigeria', 'Kebbi', 'Birnin Kebbi', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Confluence Beach Hotel, Lokoja', 'Confluence Beach Hotel is one of Kogi''s best-known hotels, located in Lokoja. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 32000, 'per_night', 'Nigeria', 'Kogi', 'Lokoja', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kwara Hotel, Ilorin', 'Kwara Hotel is one of Kwara''s best-known hotels, located in Ilorin. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 38000, 'per_night', 'Nigeria', 'Kwara', 'Ilorin', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Lafia City Hotel, Lafia', 'Lafia City Hotel is one of Nasarawa''s best-known hotels, located in Lafia. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 26000, 'per_night', 'Nigeria', 'Nasarawa', 'Lafia', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Chida Hotel, Minna', 'Chida Hotel is one of Niger''s best-known hotels, located in Minna. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 30000, 'per_night', 'Nigeria', 'Niger', 'Minna', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Gateway Hotel, Abeokuta', 'Gateway Hotel is one of Ogun''s best-known hotels, located in Abeokuta. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 40000, 'per_night', 'Nigeria', 'Ogun', 'Abeokuta', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Owena Royal Hotel, Akure', 'Owena Royal Hotel is one of Ondo''s best-known hotels, located in Akure. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 38000, 'per_night', 'Nigeria', 'Ondo', 'Akure', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Osun Presidential Hotel, Osogbo', 'Osun Presidential Hotel is one of Osun''s best-known hotels, located in Osogbo. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 32000, 'per_night', 'Nigeria', 'Osun', 'Osogbo', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Hill Station Hotel, Jos', 'Hill Station Hotel is one of Plateau''s best-known hotels, located in Jos. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 45000, 'per_night', 'Nigeria', 'Plateau', 'Jos', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Sokoto Guest Inn, Sokoto', 'Sokoto Guest Inn is one of Sokoto''s best-known hotels, located in Sokoto. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 26000, 'per_night', 'Nigeria', 'Sokoto', 'Sokoto', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Mayor''s Hotel, Jalingo', 'Mayor''s Hotel is one of Taraba''s best-known hotels, located in Jalingo. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 24000, 'per_night', 'Nigeria', 'Taraba', 'Jalingo', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Pinnacle Hotel, Damaturu', 'Pinnacle Hotel is one of Yobe''s best-known hotels, located in Damaturu. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 24000, 'per_night', 'Nigeria', 'Yobe', 'Damaturu', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Zamfara Hotel, Gusau', 'Zamfara Hotel is one of Zamfara''s best-known hotels, located in Gusau. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 24000, 'per_night', 'Nigeria', 'Zamfara', 'Gusau', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Ahia-Ohuru Hotel, Umuahia', 'Ahia-Ohuru Hotel is one of Abia''s best-known hotels, located in Umuahia. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 28000, 'per_night', 'Nigeria', 'Abia', 'Umuahia', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Tourist Centre Hotel, Jimeta-Yola', 'Tourist Centre Hotel is one of Adamawa''s best-known hotels, located in Jimeta-Yola. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 26000, 'per_night', 'Nigeria', 'Adamawa', 'Jimeta-Yola', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Four Seasons Hotel Cairo at Nile Plaza, Cairo', 'Four Seasons Hotel Cairo at Nile Plaza is one of Egypt''s best-known hotels, located in Cairo. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 320000, 'per_night', 'Egypt', NULL, 'Cairo', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80','https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Villa Rosa Kempinski Nairobi, Nairobi', 'Villa Rosa Kempinski Nairobi is one of Kenya''s best-known hotels, located in Nairobi. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 260000, 'per_night', 'Kenya', NULL, 'Nairobi', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('The Table Bay Hotel, Cape Town', 'The Table Bay Hotel is one of South Africa''s best-known hotels, located in Cape Town. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 340000, 'per_night', 'South Africa', NULL, 'Cape Town', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kempinski Hotel Gold Coast City, Accra', 'Kempinski Hotel Gold Coast City is one of Ghana''s best-known hotels, located in Accra. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 280000, 'per_night', 'Ghana', NULL, 'Accra', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('La Mamounia, Marrakech', 'La Mamounia is one of Morocco''s best-known hotels, located in Marrakech. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 450000, 'per_night', 'Morocco', NULL, 'Marrakech', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Sheraton Addis, Addis Ababa', 'Sheraton Addis is one of Ethiopia''s best-known hotels, located in Addis Ababa. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 210000, 'per_night', 'Ethiopia', NULL, 'Addis Ababa', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Hyatt Regency Dar es Salaam, The Kilimanjaro, Dar es Salaam', 'Hyatt Regency Dar es Salaam, The Kilimanjaro is one of Tanzania''s best-known hotels, located in Dar es Salaam. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 230000, 'per_night', 'Tanzania', NULL, 'Dar es Salaam', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kigali Marriott Hotel, Kigali', 'Kigali Marriott Hotel is one of Rwanda''s best-known hotels, located in Kigali. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 240000, 'per_night', 'Rwanda', NULL, 'Kigali', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Radisson Blu Hotel Dakar Sea Plaza, Dakar', 'Radisson Blu Hotel Dakar Sea Plaza is one of Senegal''s best-known hotels, located in Dakar. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 250000, 'per_night', 'Senegal', NULL, 'Dakar', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Sofitel Abidjan Hotel Ivoire, Abidjan', 'Sofitel Abidjan Hotel Ivoire is one of Côte d''Ivoire''s best-known hotels, located in Abidjan. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 260000, 'per_night', 'Côte d''Ivoire', NULL, 'Abidjan', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('The Residence Tunis, Tunis', 'The Residence Tunis is one of Tunisia''s best-known hotels, located in Tunis. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 300000, 'per_night', 'Tunisia', NULL, 'Tunis', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Sheraton Club des Pins Resort, Algiers', 'Sheraton Club des Pins Resort is one of Algeria''s best-known hotels, located in Algiers. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 220000, 'per_night', 'Algeria', NULL, 'Algiers', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Kampala Serena Hotel, Kampala', 'Kampala Serena Hotel is one of Uganda''s best-known hotels, located in Kampala. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 230000, 'per_night', 'Uganda', NULL, 'Kampala', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Radisson Blu Hotel Lusaka, Lusaka', 'Radisson Blu Hotel Lusaka is one of Zambia''s best-known hotels, located in Lusaka. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 210000, 'per_night', 'Zambia', NULL, 'Lusaka', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('The Victoria Falls Hotel, Victoria Falls', 'The Victoria Falls Hotel is one of Zimbabwe''s best-known hotels, located in Victoria Falls. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 280000, 'per_night', 'Zimbabwe', NULL, 'Victoria Falls', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Hilton Windhoek, Windhoek', 'Hilton Windhoek is one of Namibia''s best-known hotels, located in Windhoek. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 230000, 'per_night', 'Namibia', NULL, 'Windhoek', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Avani Gaborone Resort & Casino, Gaborone', 'Avani Gaborone Resort & Casino is one of Botswana''s best-known hotels, located in Gaborone. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 200000, 'per_night', 'Botswana', NULL, 'Gaborone', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Polana Serena Hotel, Maputo', 'Polana Serena Hotel is one of Mozambique''s best-known hotels, located in Maputo. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 220000, 'per_night', 'Mozambique', NULL, 'Maputo', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Akwa Palace Hotel, Douala', 'Akwa Palace Hotel is one of Cameroon''s best-known hotels, located in Douala. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 150000, 'per_night', 'Cameroon', NULL, 'Douala', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Pullman Kinshasa Grand Hotel, Kinshasa', 'Pullman Kinshasa Grand Hotel is one of DR Congo''s best-known hotels, located in Kinshasa. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 260000, 'per_night', 'Congo (DRC)', NULL, 'Kinshasa', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('EPIC SANA Luanda Hotel, Luanda', 'EPIC SANA Luanda Hotel is one of Angola''s best-known hotels, located in Luanda. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 300000, 'per_night', 'Angola', NULL, 'Luanda', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80','https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('One&Only Le Saint Géran, Grand Baie', 'One&Only Le Saint Géran is one of Mauritius''s best-known hotels, located in Grand Baie. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 520000, 'per_night', 'Mauritius', NULL, 'Grand Baie', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80','https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Four Seasons Resort Seychelles, Mahé', 'Four Seasons Resort Seychelles is one of Seychelles''s best-known hotels, located in Mahé. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 600000, 'per_night', 'Seychelles', NULL, 'Mahé', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80','https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Corinthia Hotel Tripoli, Tripoli', 'Corinthia Hotel Tripoli is one of Libya''s best-known hotels, located in Tripoli. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 210000, 'per_night', 'Libya', NULL, 'Tripoli', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false),
  ('Corinthia Hotel Khartoum, Khartoum', 'Corinthia Hotel Khartoum is one of Sudan''s best-known hotels, located in Khartoum. Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. PengStays admin: verify current rates directly with the property (or via your Booking.com extranet/partner account) and update this listing''s price and details before promoting it.', 'hotel', 190000, 'per_night', 'Sudan', NULL, 'Khartoum', NULL, NULL, ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80','https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80'], '2348146730044', 'samuelivere92@gmail.com', 'approved', false);
