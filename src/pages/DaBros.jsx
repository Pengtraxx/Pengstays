import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users, Plus, LogIn, CreditCard } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrosListingCard from "@/components/dabros/BrosListingCard";
import { BROS_PRICE, BROS_PERIOD_DAYS, hasActiveBrosSubscription, formatPrice } from "@/lib/plans";

export default function DaBros() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Guest-payment gate state
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    db.auth.me()
      .then((u) => {
        setUser(u);
        if (hasActiveBrosSubscription(u)) {
          return db.entities.BrosListing.filter({ status: "active" }, "-created_date", 100).then(setListings);
        }
      })
      .catch(() => setUser(null))
      .finally(() => { setChecked(true); setLoading(false); });
  }, []);

  const payAsGuest = async () => {
    if (!guestEmail.trim()) return;
    setPayError("");
    setPaying(true);
    try {
      const res = await db.functions.invoke("flutterwave", {
        action: "initiate_bros",
        guest_email: guestEmail.trim(),
        guest_name: guestName.trim() || undefined,
        redirect_url: `${window.location.origin}/payment-callback`,
      });
      if (res.data?.link) window.location.href = res.data.link;
      else { setPayError(res.data?.error || "Could not start payment."); setPaying(false); }
    } catch (e) {
      setPayError(e.response?.data?.error || "Could not start payment.");
      setPaying(false);
    }
  };

  const payAsMember = async () => {
    setPayError("");
    setPaying(true);
    try {
      const res = await db.functions.invoke("flutterwave", {
        action: "initiate_bros",
        redirect_url: `${window.location.origin}/payment-callback`,
      });
      if (res.data?.link) window.location.href = res.data.link;
      else { setPayError(res.data?.error || "Could not start payment."); setPaying(false); }
    } catch (e) {
      setPayError(e.response?.data?.error || "Could not start payment.");
      setPaying(false);
    }
  };

  if (!checked) {
    return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;
  }

  const subscribed = hasActiveBrosSubscription(user);

  // Gate: no active access yet — same paywall whether you're logged in or not.
  if (!subscribed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Users className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="font-display text-3xl text-emerald-950">Da Bros</h1>
        <p className="text-muted-foreground text-sm mt-2">
          A members-only marketplace — 3–4 photo posts, in-app chat, and direct WhatsApp with the
          seller. Access costs {formatPrice(BROS_PRICE)} every {BROS_PERIOD_DAYS} days.
        </p>

        {payError && <p className="text-xs text-destructive mt-4">{payError}</p>}

        {user ? (
          <Button onClick={payAsMember} disabled={paying} className="mt-6 bg-amber-400 text-emerald-950 hover:bg-amber-300 rounded-full px-8">
            {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Pay {formatPrice(BROS_PRICE)} with Flutterwave
          </Button>
        ) : (
          <div className="mt-6 space-y-2 text-left">
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name (optional)" />
            <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Your email" required />
            <Button onClick={payAsGuest} disabled={paying || !guestEmail.trim()} className="w-full bg-amber-400 text-emerald-950 hover:bg-amber-300 rounded-full">
              {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Pay {formatPrice(BROS_PRICE)} with Flutterwave
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              After payment, you'll set up an account with this email to access Da Bros. Already have one?{" "}
              <Link to={`/login?returnTo=/da-bros${guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : ""}`} className="text-primary hover:underline inline-flex items-center gap-0.5">
                <LogIn className="w-3 h-3" /> Log in first
              </Link>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-emerald-950 flex items-center gap-2">
            <Users className="w-7 h-7 text-amber-500" /> Da Bros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Access active until {user.bros_subscription_expires} — chat in-app or on WhatsApp with the person listing.
          </p>
        </div>
        <Link to="/da-bros/create" className="inline-flex items-center gap-2 bg-amber-400 text-emerald-950 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-amber-300 transition-colors w-fit">
          <Plus className="w-4 h-4" /> Post something
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : listings.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {listings.map((l) => <BrosListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-20 border border-dashed rounded-2xl">
          Nothing posted yet — be the first to post something to Da Bros.
        </p>
      )}
    </div>
  );
}
