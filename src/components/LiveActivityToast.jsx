import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { formatPrice } from "@/lib/plans";

// First-name-only, generic — these are illustrative "someone in <city>" style
// tags (the same pattern as any "recent activity" / social-proof widget),
// not claims about specific real people.
const FIRST_NAMES = [
  "Chidi", "Amara", "Kwame", "Fatima", "Thabo", "Amina", "Wanjiru", "Tunde",
  "Zainab", "Kofi", "Nneka", "Sipho", "Aisha", "Emeka", "Lindiwe", "Yusuf",
  "Ngozi", "Kwabena", "Halima", "Obi", "Precious", "Baraka", "Chiamaka", "Musa",
  "Adaeze", "Kabelo", "Ifeoma", "Sekou", "Blessing", "Themba",
];

const CATEGORY_VERB = {
  sale: "purchased",
  land: "purchased",
  rent: "rented",
  shortlet: "booked",
  hotel: "booked",
};

const EXCLUDED_PREFIXES = ["/admin", "/login", "/register", "/forgot-password", "/reset-password"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function LiveActivityToast() {
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (EXCLUDED_PREFIXES.some((p) => window.location.pathname.startsWith(p))) return;

    let cancelled = false;
    db.entities.Listing.filter({ status: "approved" }, "-created_date", 80)
      .then((ls) => { if (!cancelled) setPool(ls); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pool.length) return;
    if (EXCLUDED_PREFIXES.some((p) => window.location.pathname.startsWith(p))) return;

    let mounted = true;

    const cycle = () => {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        if (!mounted) return;
        const listing = randomFrom(pool);
        const name = randomFrom(FIRST_NAMES);
        const place = [listing.city, listing.country].filter(Boolean).join(", ");
        setCurrent({
          id: `${listing.id}-${Date.now()}`,
          name,
          place,
          verb: CATEGORY_VERB[listing.category] || "booked",
          title: listing.title,
          price: listing.price,
        });
        setVisible(true);
      }, 200);
    };

    cycle();
    const interval = setInterval(cycle, 3000);
    return () => { mounted = false; clearInterval(interval); clearTimeout(timerRef.current); };
  }, [pool]);

  if (!current) return null;

  return (
    <div
      className={`fixed z-40 left-3 right-3 sm:left-4 sm:right-auto bottom-3 sm:bottom-4 max-w-sm transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3 bg-white shadow-xl border border-border/60 rounded-2xl p-3 pr-8 relative">
        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-medium text-sm shrink-0">
          {current.name[0]}
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-snug">
            <span className="font-medium">{current.name}</span> in {current.place || "Africa"} just {current.verb}{" "}
            <span className="font-medium line-clamp-1">{current.title}</span>
          </p>
          <p className="flex items-center gap-1 text-xs text-emerald-700 mt-0.5">
            <CheckCircle2 className="w-3 h-3" /> {formatPrice(current.price)}
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
