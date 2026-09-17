// Supabase Edge Function: Flutterwave v3 payments — seller subscription
// plans, "boost listing" charges, direct listing bookings (guests allowed),
// and Da Bros access (guests allowed too — see initiate_bros/verify_bros).
// Deploy with:
//   supabase functions deploy flutterwave
// and set the secret with:
//   supabase secrets set FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxx
//
// The secret key never reaches the browser — all Flutterwave API calls
// happen here, server-side, using the v3 REST API
// (https://api.flutterwave.com/v3/...).

import { createClient } from "jsr:@supabase/supabase-js@2";

// Inlined (not imported from ../_shared) — some Supabase CLI versions fail
// to bundle cross-folder imports on deploy ("Module not found _shared/...").
// Keeping this self-contained avoids that entirely.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_PRICES: Record<string, number> = { sale_rent: 5000, shortlet: 10000, hotel: 35000, land: 5000 };
const FEATURE_PRICE = 5000;
const BROS_PRICE = 20000;
const BROS_PERIOD_DAYS = 14;
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

// Actions that a guest (no account) is allowed to call.
const GUEST_ALLOWED_ACTIONS = new Set(["initiate_booking", "verify_booking", "initiate_bros", "verify_bros"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, plan, transaction_id, tx_ref, redirect_url, listing_id, guest_name, guest_email } = body;

    // Try to identify the caller if they sent a session — but for guest
    // actions, no session is required at all.
    const authHeader = req.headers.get("Authorization");
    let user: { id: string; email: string; user_metadata?: Record<string, unknown> } | null = null;
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await supabaseUser.auth.getUser();
      if (data?.user) user = data.user;
    }

    if (!user && !GUEST_ALLOWED_ACTIONS.has(action)) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Service-role client — bypasses RLS for the privileged writes below
    // (subscriptions, listings, profiles) after Flutterwave verification.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const flwSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flwSecretKey) return json({ error: "Payments are not configured" }, 500);

    const payerEmail = user?.email || guest_email;
    const payerName = user?.user_metadata?.full_name || user?.email || guest_name || payerEmail;

    if (action === "initiate_booking") {
      if (!payerEmail) return json({ error: "An email is required to pay." }, 400);

      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("*")
        .eq("id", listing_id)
        .single();
      if (!listing || listing.status !== "approved") {
        return json({ error: "Listing is not available for payment" }, 400);
      }

      const amount = listing.price;
      const txRef = "book-" + (user?.id || "guest") + "-" + Date.now();

      const flwRes = await fetch(`${FLW_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount,
          currency: "NGN",
          redirect_url,
          customer: { email: payerEmail, name: payerName },
          customizations: {
            title: "PengStays — " + listing.title,
            description: `${listing.category === "sale" ? "Purchase" : "Booking"} payment`,
          },
        }),
      });
      const flwData = await flwRes.json();
      if (flwData.status !== "success" || !flwData.data?.link) {
        return json({ error: flwData.message || "Payment initiation failed" }, 400);
      }

      const { error: insertError } = await supabaseAdmin.from("booking_requests").insert({
        listing_id: listing.id,
        listing_title: listing.title,
        to_user_id: listing.created_by_id,
        name: payerName,
        contact: payerEmail,
        type: listing.category === "sale" ? "inspection" : "booking",
        status: "pending",
        amount,
        tx_ref: txRef,
        paid: false,
        created_by_id: user?.id || null,
        note: `Online payment of ${amount} NGN initiated via Flutterwave for "${listing.title}".`,
      });
      if (insertError) return json({ error: insertError.message }, 500);

      return json({ link: flwData.data.link, tx_ref: txRef });
    }

    if (action === "verify_booking") {
      const flwRes = await fetch(`${FLW_BASE_URL}/transactions/${transaction_id}/verify`, {
        headers: { Authorization: `Bearer ${flwSecretKey}` },
      });
      const flwData = await flwRes.json();
      const tx = flwData.data;

      if (
        flwData.status !== "success" ||
        !tx ||
        tx.status !== "successful" ||
        tx.tx_ref !== tx_ref ||
        tx.currency !== "NGN"
      ) {
        return json({ error: "Payment verification failed" }, 400);
      }

      const { data: bookings } = await supabaseAdmin
        .from("booking_requests")
        .select("*")
        .eq("tx_ref", tx_ref)
        .limit(1);
      const booking = bookings?.[0];

      if (!booking || Number(tx.amount) < Number(booking.amount)) {
        return json({ error: "Payment record mismatch" }, 400);
      }
      if (booking.paid) {
        return json({ success: true, listing_title: booking.listing_title });
      }

      await supabaseAdmin
        .from("booking_requests")
        .update({ paid: true, status: "confirmed", flw_transaction_id: String(transaction_id) })
        .eq("id", booking.id);

      return json({ success: true, listing_title: booking.listing_title, booking: true });
    }

    if (action === "initiate_bros") {
      if (!payerEmail) return json({ error: "An email is required to pay." }, 400);

      const txRef = "bros-" + (user?.id || "guest") + "-" + Date.now();

      const flwRes = await fetch(`${FLW_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: BROS_PRICE,
          currency: "NGN",
          redirect_url,
          customer: { email: payerEmail, name: payerName },
          customizations: {
            title: "PengStays — Da Bros",
            description: `${BROS_PERIOD_DAYS}-day Da Bros access`,
          },
        }),
      });
      const flwData = await flwRes.json();
      if (flwData.status !== "success" || !flwData.data?.link) {
        return json({ error: flwData.message || "Payment initiation failed" }, 400);
      }

      const { error: insertError } = await supabaseAdmin.from("bros_subscriptions").insert({
        amount: BROS_PRICE,
        tx_ref: txRef,
        status: "pending",
        created_by_id: user?.id || null,
        payer_email: payerEmail,
      });
      if (insertError) return json({ error: insertError.message }, 500);

      return json({ link: flwData.data.link, tx_ref: txRef });
    }

    if (action === "verify_bros") {
      const flwRes = await fetch(`${FLW_BASE_URL}/transactions/${transaction_id}/verify`, {
        headers: { Authorization: `Bearer ${flwSecretKey}` },
      });
      const flwData = await flwRes.json();
      const tx = flwData.data;

      if (
        flwData.status !== "success" ||
        !tx ||
        tx.status !== "successful" ||
        tx.tx_ref !== tx_ref ||
        tx.currency !== "NGN"
      ) {
        return json({ error: "Payment verification failed" }, 400);
      }

      const { data: subs } = await supabaseAdmin
        .from("bros_subscriptions")
        .select("*")
        .eq("tx_ref", tx_ref)
        .limit(1);
      const sub = subs?.[0];

      if (!sub || Number(tx.amount) < Number(sub.amount)) {
        return json({ error: "Payment record mismatch" }, 400);
      }
      if (sub.status === "active") {
        return json({ success: true, expires: sub.period_end, payer_email: sub.payer_email });
      }

      const periodStart = new Date().toISOString().split("T")[0];
      const periodEnd = new Date(Date.now() + BROS_PERIOD_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await supabaseAdmin
        .from("bros_subscriptions")
        .update({
          status: "active",
          flw_transaction_id: String(transaction_id),
          period_start: periodStart,
          period_end: periodEnd,
        })
        .eq("id", sub.id);

      // If the payer already has an account (they were logged in when they
      // paid), activate it immediately. If they paid as a guest, this gets
      // finalized when they register/log in — see the "claim" RLS policy
      // and db.auth.me() in src/api/supabaseClient.js.
      if (sub.created_by_id) {
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: sub.created_by_id, bros_subscription_active: true, bros_subscription_expires: periodEnd });
      }

      return json({ success: true, expires: periodEnd, payer_email: sub.payer_email, claimed: !!sub.created_by_id });
    }

    if (action === "initiate") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const isFeature = plan === "feature";
      const amount = isFeature ? FEATURE_PRICE : PLAN_PRICES[plan];
      if (!amount || (isFeature && !listing_id)) return json({ error: "Invalid plan" }, 400);

      const txRef = (isFeature ? "feat-" : "sub-") + user.id + "-" + Date.now();

      const flwRes = await fetch(`${FLW_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount,
          currency: "NGN",
          redirect_url,
          customer: { email: user.email, name: payerName },
          customizations: {
            title: "PengStays Listing Subscription",
            description: `${plan} plan`,
          },
        }),
      });
      const flwData = await flwRes.json();
      if (flwData.status !== "success" || !flwData.data?.link) {
        return json({ error: flwData.message || "Payment initiation failed" }, 400);
      }

      const { error: insertError } = await supabaseAdmin.from("subscriptions").insert({
        plan,
        amount,
        tx_ref: txRef,
        status: "pending",
        user_email: user.email,
        created_by_id: user.id,
        listing_id: isFeature ? listing_id : null,
      });
      if (insertError) return json({ error: insertError.message }, 500);

      return json({ link: flwData.data.link, tx_ref: txRef });
    }

    if (action === "verify") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const flwRes = await fetch(`${FLW_BASE_URL}/transactions/${transaction_id}/verify`, {
        headers: { Authorization: `Bearer ${flwSecretKey}` },
      });
      const flwData = await flwRes.json();
      const tx = flwData.data;

      if (
        flwData.status !== "success" ||
        !tx ||
        tx.status !== "successful" ||
        tx.tx_ref !== tx_ref ||
        tx.currency !== "NGN"
      ) {
        return json({ error: "Payment verification failed" }, 400);
      }

      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("tx_ref", tx_ref)
        .limit(1);
      const sub = subs?.[0];

      if (!sub || sub.user_email !== user.email || Number(tx.amount) < Number(sub.amount)) {
        return json({ error: "Payment record mismatch" }, 400);
      }
      if (sub.status === "active") {
        return json({ success: true, plan: sub.plan, expires: sub.expires_date });
      }

      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "active", flw_transaction_id: String(transaction_id), expires_date: expires })
        .eq("id", sub.id);

      if (sub.plan === "feature" && sub.listing_id) {
        await supabaseAdmin
          .from("listings")
          .update({ featured: true, featured_expires: expires })
          .eq("id", sub.listing_id);
      } else {
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: user.id, plan: sub.plan, subscription_active: true, subscription_expires: expires });
      }

      return json({ success: true, plan: sub.plan, expires });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
