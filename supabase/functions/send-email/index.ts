// Supabase Edge Function: transactional email (booking/inspection request
// notifications). Uses Resend (https://resend.com) if RESEND_API_KEY is set;
// otherwise it's a safe no-op so the app keeps working without email
// configured — booking requests still land in the owner's Dashboard either
// way.
//
// Deploy with:  supabase functions deploy send-email
// Configure with:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//   supabase secrets set RESEND_FROM_EMAIL="PengStays <notifications@yourdomain.com>"

// Inlined (not imported from ../_shared) — some Supabase CLI versions fail
// to bundle cross-folder imports on deploy ("Module not found _shared/...").
// Keeping this self-contained avoids that entirely.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, from_name, subject, body } = await req.json();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendKey) {
      // Not configured — don't fail the caller, just skip sending.
      return json({ skipped: true, reason: "Email is not configured" });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject || (from_name ? `New message from ${from_name}` : "New notification"),
        text: body || "",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: err }, 502);
    }

    return json({ success: true });
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
