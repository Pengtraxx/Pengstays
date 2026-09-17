# PengStays (Afrispace Stay Book)

A property marketplace for Africa — sale, rent, shortlets and hotels — built with React + Vite,
[Supabase](https://supabase.com) (Postgres, Auth, Storage, Edge Functions), and
[Flutterwave v3](https://developer.flutterwave.com/docs) for payments. No Base44 dependency.

## 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings -> API**, copy the **Project URL** and **anon public** key.
3. Copy `.env.example` to `.env.local` and fill them in:

   ```bash
   cp .env.example .env.local
   ```

## 2. Apply the database schema

**Everything (schema + RLS + the 62-listing starter hotel catalog) is in one file now:**
`supabase/schema_full_reset.sql`. Run it once in the Supabase **SQL Editor** (or via the CLI — see
below). It's the single source of truth for the database going forward; the old
`supabase/migrations/` files have been superseded by it and moved to `migrations_deprecated/` for
reference only.

```bash
# via CLI
supabase login
supabase link --project-ref your-project-ref
psql "$(supabase db url)" -f supabase/schema_full_reset.sql
# or: paste the whole file into the SQL Editor in the dashboard and run it
```

**This drops and recreates every PengStays table** (listings, profiles, bookings, messages, ads,
Da Bros — everything). If your schema's gotten into a broken state, this is the fix — it's meant
to be safely re-run any time you need a clean slate. It does **not** touch `auth.users` (your
actual registered accounts are untouched), only the `public.*` app tables. Anything you added by
hand outside this file will be lost, so re-run it early rather than after you've built up real
data you care about.

It creates every table, Row Level Security policy, the admin-role signup trigger, the public
`uploads` storage bucket, realtime for live analytics + Da Bros chat, **and seeds all 62 starter
hotel listings** in the same run — no separate seed step needed anymore.

The very first person to sign up with the email hard-coded in `src/lib/plans.js`
(`ADMIN_EMAIL`) is automatically made an admin — update that constant to your own email before
going live, then re-run the script (or update your `profiles` row's `role` to `admin` by hand).

**About the seeded hotel prices — read before you rely on them:** these are *not* pulled live from
Booking.com. I'm not able to scrape or mirror Booking.com's live pricing/availability feed (their
data is proprietary and constantly changing, and there's no way to guarantee accuracy at request
time). Instead, each row is a real, well-known hotel with an **indicative placeholder nightly
rate**, so you have a full, browsable catalog on day one — every listing's description also says
so explicitly. Once you strike a real deal or confirm current pricing, open that listing from
`/admin` and hit **Edit** to update the price, description, and photos — your margin is whatever
you set the price to.

## 4. Configure Flutterwave v3

Get your **Secret Key** from the [Flutterwave dashboard](https://dashboard.flutterwave.com)
(Settings -> API), then set it as a server-side secret — it must never reach the browser:

```bash
supabase secrets set FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxx
```

Deploy the payment Edge Function:

```bash
supabase functions deploy flutterwave
```

Payments flow: the app calls the `flutterwave` function to create a v3 checkout session
(`POST /v3/payments`), redirects the user to Flutterwave's hosted checkout, then verifies the
transaction server-side (`GET /v3/transactions/{id}/verify`) before activating the subscription,
featured-listing boost, listing booking/purchase, or Da Bros access — all Flutterwave API calls
happen inside the Edge Function. Listing bookings and Da Bros access can be paid for by guests
(no account needed to pay); seller subscriptions and featured-listing boosts require login.

## 5. (Optional) Email notifications

Booking/inspection request emails are sent via [Resend](https://resend.com) through the
`send-email` Edge Function. Without it configured, the app still works — requests still show up
in the recipient's Dashboard, they just won't get an email.

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="PengStays <notifications@yourdomain.com>"
supabase functions deploy send-email
```

## 6. Auth setup notes

- **Instant sign-up, no code required (recommended)**: in the Supabase dashboard, go to
  **Authentication -> Providers -> Email** and turn **"Confirm email" OFF**. With that off,
  `supabase.auth.signUp()` logs the person in immediately — no verification step at all, exactly
  the "just sign up" flow. The Register page already adapts to this automatically.
- **If you'd rather keep email confirmation on**: leave that toggle on and instead go to
  **Authentication -> Email Templates -> Confirm signup** and make sure the template includes
  `{{ .Token }}` (a 6-digit code) — the Register page falls back to asking for that code only when
  the project still requires confirmation.
- **Sign-in method**: email/password only — there's no social/OAuth sign-in in this app by design.
- **Password reset**: under **Authentication -> URL Configuration**, add
  `http://localhost:5173/reset-password` (and your production URL) to the allow list.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

## Build

```bash
npm run build
```

Outputs to `./dist`.

## Project structure

- `src/` — frontend (pages, components, hooks)
- `src/api/supabaseClient.js` — data/auth/storage layer (`db.entities.*`, `db.auth.*`, `db.functions`, `db.integrations.Core.*`)
- `supabase/schema_full_reset.sql` — the full DB schema + RLS + seed data (source of truth; safely rerunnable)
- `supabase/migrations_deprecated/` — superseded by the file above, kept for reference only
- `supabase/functions/` — Edge Functions (`flutterwave`, `send-email`)

## Feature notes

- **Branding**: the PengStays logo (`public/logo.jpg`, `public/logo-icon.png`) is used in the nav, footer, favicon, and homepage hero.
- **Categories**: Sale, Rent, Shortlet, Hotel, and **Land** — land sales are announced in the scrolling
  bar above the header and have their own subscription plan and homepage section.
- **Buy/Book routing**: every listing card and detail page has a "Buy"/"Book via WhatsApp" button that
  opens WhatsApp to **+234 814 673 0044**, pre-addressed to HSPR ADMIN, with the listing's name, price,
  and link pre-filled.
- **Pay online**: listing detail pages also have a "Pay Online" button that charges the full listing
  price through the `flutterwave` Edge Function (`initiate_booking` / `verify_booking` actions) and
  marks the booking as paid once verified.
- **Inquiries & admin email**: every inquiry and booking/inspection request is emailed to
  **samuelivere92@gmail.com** (the sole admin) in addition to the listing owner, via the `send-email`
  Edge Function.
- **Admin-only access**: `ADMIN_EMAIL` in `src/lib/plans.js` (samuelivere92@gmail.com) is the only
  account that can reach `/admin`. From there they can approve/reject/**delete** any listing, view live
  visitor analytics, see all bookings & payments, and publish/remove homepage ad banners (Ads tab).
- **Ads**: the `ads` table + Admin "Ads" tab let the admin run simple promotional banners that rotate
  in a carousel on the homepage.
- **No sign-up needed to browse, chat, or pay**: viewing listings, messaging an owner, requesting a
  booking/inspection, chatting the admin on WhatsApp, and now **paying online for a listing**
  (`initiate_booking`/`verify_booking`) all work for anonymous visitors — they just type a
  name + email inline. Nothing on the main PengStays site requires an account except *listing your
  own property* (which requires a paid seller subscription — see `/subscribe`).
- **Da Bros** (`/da-bros`): a separate, paid peer marketplace. **Viewing, posting, and chatting all
  require an active ₦20,000 / 14-day subscription** — there's no free tier. Each post has 3–4
  photos, the poster's own WhatsApp link, and a realtime in-app chat (`bros_messages`, via
  `src/components/dabros/BrosChat.jsx`). Guests can pay for access before creating an account — the
  payment is matched to them by email once they register or log in with that same email (see the
  `bros_subscriptions_claim` RLS policy and `claimBrosSubscription()` in
  `src/api/supabaseClient.js`); already-logged-in users get access activated immediately on
  payment. This is a *prompted* renewal, not silent auto-billing — Flutterwave's true
  recurring/tokenized charges are a bigger integration (card tokenization + a server-side cron)
  that would need its own follow-up if you want it to charge automatically without the user
  revisiting the site.
- **Email/password only**: no Google or other social sign-in — by design, per the current auth
  requirements.

