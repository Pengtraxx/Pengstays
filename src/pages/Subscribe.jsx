import React, { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, formatPrice, hasActiveSubscription } from "@/lib/plans";
import { Link } from "react-router-dom";

export default function Subscribe() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selected, setSelected] = useState(urlParams.get("plan") || "sale_rent");
  const [whatsapp, setWhatsapp] = useState("");
  const [user, setUser] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    db.auth.me().then((u) => {
      setUser(u);
      if (u?.whatsapp_number) setWhatsapp(u.whatsapp_number);
    }).catch(() => setUser(null));
  }, []);

  const pay = async () => {
    setError("");
    const authed = await db.auth.isAuthenticated();
    if (!authed) { db.auth.redirectToLogin(`/subscribe?plan=${selected}`); return; }
    if (!whatsapp.trim()) { setError("Please enter your WhatsApp number — buyers will contact you on it."); return; }
    setPaying(true);
    try {
      await db.auth.updateMe({ whatsapp_number: whatsapp.trim() });
      const res = await db.functions.invoke("flutterwave", {
        action: "initiate",
        plan: selected,
        redirect_url: window.location.origin + "/payment-callback"
      });
      if (res.data?.link) {
        window.location.href = res.data.link;
      } else {
        setError(res.data?.error || "Could not start payment. Please try again.");
        setPaying(false);
      }
    } catch (e) {
      setError(e.response?.data?.error || "Could not start payment. Please try again.");
      setPaying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-10">
        <p className="text-emerald-700 tracking-[0.3em] text-xs uppercase mb-2">Become a Lister</p>
        <h1 className="font-display text-3xl sm:text-5xl text-emerald-950">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-3 text-sm">Secure monthly subscription — paid safely via Flutterwave.</p>
      </div>

      {hasActiveSubscription(user) && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 mb-8 text-sm text-center">
          You already have an active <strong>{PLANS[user.plan]?.label}</strong> subscription until {user.subscription_expires}.{" "}
          <Link to="/create" className="underline font-medium">Create a listing</Link>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(PLANS).map(([key, p]) => (
          <button key={key} onClick={() => setSelected(key)}
            className={`text-left rounded-2xl border-2 p-6 transition-all ${
              selected === key ? "border-emerald-800 bg-emerald-50 shadow-md" : "border-border hover:border-emerald-800/40"
            }`}>
            <div className="flex justify-between items-start">
              <h3 className="font-medium">{p.label}</h3>
              {selected === key && <Check className="w-5 h-5 text-emerald-800" />}
            </div>
            <p className="font-display text-3xl mt-3 text-emerald-900">{formatPrice(p.price)}<span className="text-sm text-muted-foreground font-body">/mo</span></p>
            <p className="text-xs text-muted-foreground mt-2">
              List under: {p.categories.map((c) => c === "sale" ? "For Sale" : c === "rent" ? "For Rent" : c === "shortlet" ? "Shortlets" : "Hotels").join(", ")}
            </p>
          </button>
        ))}
      </div>

      <div className="max-w-md mx-auto mt-10 space-y-4">
        <div className="space-y-1.5">
          <Label>Your WhatsApp Number</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+2348012345678" />
          <p className="text-xs text-muted-foreground">Buyers and guests will message you directly on this number.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={pay} disabled={paying} className="w-full bg-emerald-900 hover:bg-emerald-800 rounded-full py-6 text-base">
          {paying ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Pay {formatPrice(PLANS[selected].price)} with Flutterwave
        </Button>
      </div>
    </div>
  );
}