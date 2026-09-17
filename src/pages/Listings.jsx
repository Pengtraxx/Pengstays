import React, { useState, useEffect } from "react";
import { LayoutGrid, Map } from "lucide-react";
import { db } from "@/api/supabaseClient";
import ListingCard from "@/components/listings/ListingCard";
import ListingsMap from "@/components/listings/ListingsMap";
import ListingsFilterBar, { DEFAULT_FILTERS } from "@/components/listings/ListingsFilterBar";

export default function Listings() {
  const urlParams = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    category: urlParams.get("category") || "all"
  });
  const [listings, setListings] = useState([]);
  const [view, setView] = useState("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.Listing.filter({ status: "approved" }, "-created_date", 200)
      .then(setListings)
      .finally(() => setLoading(false));
  }, []);

  const min = filters.minPrice === "" ? null : Number(filters.minPrice);
  const max = filters.maxPrice === "" ? null : Number(filters.maxPrice);

  const filtered = listings
    .filter((l) =>
      (filters.category === "all" || l.category === filters.category) &&
      (filters.country === "all" || l.country === filters.country) &&
      (filters.state === "all" || l.state === filters.state) &&
      (min === null || (l.price ?? 0) >= min) &&
      (max === null || (l.price ?? 0) <= max)
    )
    .sort((a, b) => {
      if (filters.sort === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
      if (filters.sort === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-emerald-950">Explore Properties</h1>
        <div className="flex bg-muted rounded-full p-1 shrink-0">
          {[["grid", LayoutGrid, "Grid"], ["map", Map, "Map"]].map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-sm transition-colors ${
                view === v ? "bg-emerald-900 text-white" : "text-foreground hover:text-emerald-900"
              }`}>
              <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <ListingsFilterBar filters={filters} onChange={setFilters} resultCount={filtered.length} />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-[4/5] bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : view === "map" ? (
        <ListingsMap listings={filtered} />
      ) : filtered.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-20 border border-dashed rounded-2xl">
          No properties match your filters yet.
        </p>
      )}
    </div>
  );
}