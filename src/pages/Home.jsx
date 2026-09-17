import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Building2, Home as HomeIcon, BedDouble, TrendingUp, ShieldCheck, Globe2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import ListingCard from "@/components/listings/ListingCard";
import AdsCarousel from "@/components/AdsCarousel";
import { CATEGORY_LABELS, PLANS, formatPrice } from "@/lib/plans";

const CATEGORIES = ["sale", "rent", "shortlet", "hotel", "land"];

const QUICK_TILES = [
  { icon: HomeIcon, label: "Rent", sub: "Find your space", to: "/listings?category=rent" },
  { icon: Building2, label: "Buy", sub: "Own your future", to: "/listings?category=sale" },
  { icon: BedDouble, label: "Book", sub: "Stay in comfort", to: "/listings?category=shortlet" },
  { icon: TrendingUp, label: "Invest", sub: "Build wealth", to: "/listings?category=land" },
];

export default function Home() {
  const [listings, setListings] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.Listing.filter({ status: "approved" }, "-created_date", 60)
      .then(setListings)
      .finally(() => setLoading(false));
    db.entities.Ad.filter({ active: true }, "-created_date", 10).then(setAds).catch(() => {});
  }, []);

  const featured = listings.filter(
    (l) => l.featured && (!l.featured_expires || new Date(l.featured_expires) >= new Date())
  ).slice(0, 8);

  return (
    <div>
      {/* Hero — premium, dark emerald + gold, matching the PengStays brand mark */}
      <section className="relative bg-[radial-gradient(circle_at_20%_20%,hsl(162,50%,14%),hsl(162,55%,6%)_60%)] text-white overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80"
          alt="" className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,hsl(162,55%,6%)_90%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
          <img src="/logo-icon.png" alt="PengStays" className="h-16 sm:h-24 w-auto object-contain mx-auto mb-5 drop-shadow-[0_0_30px_rgba(251,191,36,0.25)]" />
          <p className="text-amber-400 tracking-[0.3em] text-xs sm:text-sm uppercase mb-4">Live Better. Invest Smarter.</p>
          <h1 className="font-display text-4xl sm:text-6xl leading-tight max-w-3xl mx-auto">
            Homes, Shortlets, Hotels &amp; Land — anywhere in Africa
          </h1>
          <p className="mt-5 text-white/70 max-w-xl mx-auto text-sm sm:text-base">
            Buy, rent, or book premium properties across the continent — pay securely online with
            Flutterwave, or connect instantly on WhatsApp.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/listings" className="bg-amber-400 text-emerald-950 px-7 py-3 rounded-full font-medium hover:bg-amber-300 transition-colors">
              Explore Properties
            </Link>
            <Link to="/subscribe" className="border border-white/30 px-7 py-3 rounded-full hover:bg-white/10 transition-colors">
              List Your Property
            </Link>
          </div>

          {/* Quick tiles — mirrors the Rent / Buy / Book / Invest brand marks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-12 max-w-2xl mx-auto">
            {QUICK_TILES.map(({ icon: Icon, label, sub, to }) => (
              <Link key={label} to={to} className="border border-amber-400/30 rounded-2xl px-4 py-5 hover:bg-white/5 hover:border-amber-400/60 transition-colors">
                <Icon className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="font-medium text-sm">{label}</p>
                <p className="text-white/50 text-[11px] mt-0.5">{sub}</p>
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-10 text-white/60 text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Globe2 className="w-4 h-4 text-amber-400" /> Listings across Africa</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-amber-400" /> Every listing admin-verified</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-amber-400" /> Land sales now available</span>
          </div>
        </div>
      </section>

      <AdsCarousel ads={ads} />

      {/* Featured */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
          <h2 className="font-display text-2xl sm:text-3xl text-emerald-950 mb-5">
            <span className="text-amber-500">★</span> Featured Properties
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      {/* Category sections */}
      {CATEGORIES.map((cat) => {
        const items = listings.filter((l) => l.category === cat).slice(0, 4);
        return (
          <section key={cat} className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <div className="flex items-end justify-between mb-5">
              <h2 className="font-display text-2xl sm:text-3xl text-emerald-950">{CATEGORY_LABELS[cat]}</h2>
              <Link to={`/listings?category=${cat}`} className="text-sm text-emerald-800 hover:text-emerald-600 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                {[...Array(4)].map((_, i) => <div key={i} className="aspect-[4/5] bg-muted rounded-2xl animate-pulse" />)}
              </div>
            ) : items.length ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                {items.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-2xl">
                No {CATEGORY_LABELS[cat].toLowerCase()} listings yet — be the first to list.
              </p>
            )}
          </section>
        );
      })}

      {/* Pricing */}
      <section className="bg-[hsl(162,45%,10%)] text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-amber-400 tracking-[0.3em] text-xs uppercase mb-3">For Property Owners &amp; Investors</p>
          <h2 className="font-display text-3xl sm:text-4xl">List with PengStays</h2>
          <p className="text-white/60 mt-3 max-w-lg mx-auto text-sm">Monthly subscription, secure payments powered by Flutterwave. Reach buyers and guests across the continent.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-10 max-w-5xl mx-auto">
            {Object.entries(PLANS).map(([key, p]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col hover:border-amber-400/50 transition-colors">
                <h3 className="font-medium">{p.label}</h3>
                <p className="font-display text-3xl mt-3 text-amber-400">{formatPrice(p.price)}<span className="text-sm text-white/50 font-body">/month</span></p>
                <ul className="text-sm text-white/70 mt-5 space-y-2 text-left flex-1">
                  <li className="flex gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />Unlimited listings</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />Direct WhatsApp & in-app messages</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />Continental visibility</li>
                </ul>
                <Link to={`/subscribe?plan=${key}`} className="mt-6 bg-amber-400 text-emerald-950 rounded-full py-2.5 font-medium hover:bg-amber-300 transition-colors">
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
