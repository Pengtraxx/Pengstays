-- "Da Bros" — a peer-to-peer marketplace section, separate from the property
-- listings. Requires sign-in to view and use. A user's first post is free;
-- every post after that requires an active ₦20,000 / 14-day subscription.

alter table public.profiles
  add column if not exists bros_subscription_active boolean not null default false,
  add column if not exists bros_subscription_expires date;

create table if not exists public.bros_listings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  title text not null,
  description text,
  price numeric,
  images text[] not null default '{}',
  whatsapp_number text,
  status text not null default 'active' check (status in ('active', 'expired', 'removed')),
  expires_date date not null default (current_date + interval '14 days')
);
create index if not exists bros_listings_created_by_idx on public.bros_listings(created_by_id);
create index if not exists bros_listings_status_idx on public.bros_listings(status);

create table if not exists public.bros_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  amount numeric not null default 20000,
  tx_ref text not null unique,
  flw_transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  period_start date,
  period_end date
);
create index if not exists bros_subscriptions_created_by_idx on public.bros_subscriptions(created_by_id);

-- Two-way in-app chat, scoped to a bros_listing.
create table if not exists public.bros_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  listing_id uuid not null references public.bros_listings(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read boolean not null default false
);
create index if not exists bros_messages_listing_idx on public.bros_messages(listing_id);
create index if not exists bros_messages_to_user_idx on public.bros_messages(to_user_id);

alter table public.bros_listings enable row level security;
alter table public.bros_subscriptions enable row level security;
alter table public.bros_messages enable row level security;

-- bros_listings: the whole section requires sign-in — no anonymous access,
-- unlike the property listings.
create policy "bros_listings_select" on public.bros_listings
  for select using (
    auth.uid() is not null
    and (status = 'active' or created_by_id = auth.uid() or public.is_admin())
  );
create policy "bros_listings_insert" on public.bros_listings
  for insert with check (created_by_id = auth.uid());
create policy "bros_listings_update" on public.bros_listings
  for update using (created_by_id = auth.uid() or public.is_admin());
create policy "bros_listings_delete" on public.bros_listings
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- bros_subscriptions: users see their own; only admins (and the service-role
-- Edge Function) write.
create policy "bros_subscriptions_select" on public.bros_subscriptions
  for select using (created_by_id = auth.uid() or public.is_admin());
create policy "bros_subscriptions_admin_write" on public.bros_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- bros_messages: only the two participants (or admin) can read/write a thread.
create policy "bros_messages_select" on public.bros_messages
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_admin());
create policy "bros_messages_insert" on public.bros_messages
  for insert with check (from_user_id = auth.uid());
create policy "bros_messages_update" on public.bros_messages
  for update using (to_user_id = auth.uid() or public.is_admin());

alter publication supabase_realtime add table public.bros_messages;
