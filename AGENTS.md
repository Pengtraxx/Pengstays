# AGENTS.md

## Project Context

PengStays (Afrispace Stay Book) — a React + Vite property marketplace, backed by Supabase
(Postgres, Auth, Storage, Edge Functions) with Flutterwave v3 for payments.

## Key Files

- `src/`: frontend application source.
- `src/lib/supabase.js`: the Supabase JS client.
- `src/api/supabaseClient.js`: data/auth/storage layer used throughout the app
  (`db.entities.*`, `db.auth.*`, `db.functions.invoke`, `db.integrations.Core.*`).
- `src/lib/AuthContext.jsx`: React auth context wrapping Supabase Auth sessions.
- `supabase/migrations/0001_init.sql`: full DB schema, RLS policies, storage bucket, realtime.
- `supabase/functions/flutterwave/`: Edge Function — Flutterwave v3 payment initiate/verify.
- `supabase/functions/send-email/`: Edge Function — booking-request email notifications (Resend).
- `vite.config.js`: Vite config (React plugin + `@` -> `src` alias).
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- `npm run dev` starts the frontend against whatever Supabase project is configured in `.env.local`.
- Server-side secrets (Flutterwave, Resend) are Supabase Edge Function secrets, set via
  `supabase secrets set KEY=value` — never put them in `.env` files that ship to the browser.
- After changing `supabase/migrations/*.sql`, apply with `supabase db push` (or paste into the
  SQL Editor in the Supabase dashboard for a quick one-off run).
- After changing an Edge Function, redeploy with `supabase functions deploy <name>`.
