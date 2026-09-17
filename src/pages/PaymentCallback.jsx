import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/api/supabaseClient";

const ACTION_BY_PREFIX = { "book-": "verify_booking", "bros-": "verify_bros" };

export default function PaymentCallback() {
  const [status, setStatus] = useState("verifying"); // verifying | success | failed
  const [result, setResult] = useState(null);
  const [kind, setKind] = useState("subscription"); // subscription | booking | bros
  const [error, setError] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txStatus = urlParams.get("status");
    const txRef = urlParams.get("tx_ref");
    const transactionId = urlParams.get("transaction_id");

    if (txStatus === "cancelled" || !transactionId) {
      setStatus("failed");
      setError("Payment was cancelled or incomplete.");
      return;
    }

    // tx_ref prefix tells us which flow this is: booking/purchase payments
    // use "book-", Da Bros biweekly access uses "bros-", and subscription /
    // featured-listing payments use "sub-"/"feat-" (see the flutterwave
    // Edge Function).
    const prefix = Object.keys(ACTION_BY_PREFIX).find((p) => (txRef || "").startsWith(p));
    const action = prefix ? ACTION_BY_PREFIX[prefix] : "verify";
    const resultKind = prefix === "book-" ? "booking" : prefix === "bros-" ? "bros" : "subscription";
    setKind(resultKind);

    db.functions.invoke("flutterwave", {
      action,
      transaction_id: transactionId,
      tx_ref: txRef
    }).then((res) => {
      if (res.data?.success) { setResult(res.data); setStatus("success"); }
      else { setStatus("failed"); setError(res.data?.error || "Verification failed."); }
    }).catch((e) => {
      setStatus("failed");
      setError(e.response?.data?.error || "Verification failed.");
    });
  }, []);

  // Guest Da Bros payments (not already logged in when they paid) need an
  // account before they can actually use the access they just bought.
  const brosGuest = kind === "bros" && result && !result.claimed;

  const successCopy = {
    booking: `Your payment for "${result?.listing_title}" is confirmed. The PengStays admin and the owner have been notified.`,
    bros: brosGuest
      ? `Payment received — Da Bros access is active until ${result?.expires}. Create an account (or log in) with ${result?.payer_email} to start using it.`
      : `Da Bros access is active until ${result?.expires}.`,
    subscription: result?.plan === "feature"
      ? "Your listing is now featured on the homepage for 30 days."
      : "Your subscription is now active for 30 days. You can start listing right away.",
  }[kind];

  const successCta = brosGuest
    ? { to: `/register?email=${encodeURIComponent(result.payer_email)}&returnTo=${encodeURIComponent("/da-bros")}`, label: "Create Account" }
    : {
        booking: { to: "/dashboard", label: "View in Dashboard" },
        bros: { to: "/da-bros/create", label: "Post to Da Bros" },
        subscription: result?.plan === "feature"
          ? { to: "/dashboard", label: "Back to Dashboard" }
          : { to: "/create", label: "Create Your First Listing" },
      }[kind];

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {status === "verifying" && (
        <>
          <Loader2 className="w-12 h-12 animate-spin text-emerald-800 mx-auto" />
          <h1 className="font-display text-2xl mt-6">Verifying your payment…</h1>
          <p className="text-muted-foreground text-sm mt-2">Please don't close this page.</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
          <h1 className="font-display text-3xl mt-6 text-emerald-950">Payment Successful!</h1>
          <p className="text-muted-foreground text-sm mt-2">{successCopy}</p>
          <Link
            to={successCta.to}
            className="inline-block mt-8 bg-emerald-900 text-white px-8 py-3 rounded-full font-medium hover:bg-emerald-800 transition-colors"
          >
            {successCta.label}
          </Link>
          {brosGuest && (
            <p className="text-xs text-muted-foreground mt-3">
              Already have an account with this email?{" "}
              <Link to={`/login?email=${encodeURIComponent(result.payer_email)}&returnTo=/da-bros`} className="text-primary hover:underline">
                Log in instead
              </Link>
            </p>
          )}
        </>
      )}
      {status === "failed" && (
        <>
          <XCircle className="w-14 h-14 text-destructive mx-auto" />
          <h1 className="font-display text-3xl mt-6">Payment Failed</h1>
          <p className="text-muted-foreground text-sm mt-2">{error}</p>
          <Link to="/listings" className="inline-block mt-8 border border-emerald-900 text-emerald-900 px-8 py-3 rounded-full font-medium hover:bg-emerald-50 transition-colors">
            Back to Listings
          </Link>
        </>
      )}
    </div>
  );
}
