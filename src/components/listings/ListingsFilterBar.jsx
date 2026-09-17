import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AFRICAN_COUNTRIES, STATES_BY_COUNTRY } from "@/lib/locations";
import { CATEGORY_LABELS } from "@/lib/plans";

export const SORT_OPTIONS = {
  newest: "Newest first",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low"
};

export const DEFAULT_FILTERS = {
  category: "all",
  country: "all",
  state: "all",
  minPrice: "",
  maxPrice: "",
  sort: "newest"
};

export default function ListingsFilterBar({ filters, onChange, resultCount }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const states = STATES_BY_COUNTRY[filters.country];
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="bg-card border rounded-2xl p-4 mb-8 space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {["all", "sale", "rent", "shortlet", "hotel", "land"].map((c) => (
          <button key={c} onClick={() => set({ category: c })}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              filters.category === c ? "bg-emerald-900 text-white" : "bg-muted text-foreground hover:bg-emerald-900/10"
            }`}>
            {c === "all" ? "All Types" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Select value={filters.country} onValueChange={(v) => set({ country: v, state: "all" })}>
          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All Countries</SelectItem>
            {AFRICAN_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.state} onValueChange={(v) => set({ state: v })} disabled={!states}>
          <SelectTrigger><SelectValue placeholder={states ? "State" : "All States"} /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All States</SelectItem>
            {(states || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input type="number" min="0" inputMode="numeric" placeholder="Min price ₦"
          value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value })} />
        <Input type="number" min="0" inputMode="numeric" placeholder="Max price ₦"
          value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} />

        <Select value={filters.sort} onValueChange={(v) => set({ sort: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_OPTIONS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4" /> {resultCount} propert{resultCount === 1 ? "y" : "ies"} found
        </span>
        {isDirty && (
          <button onClick={() => onChange(DEFAULT_FILTERS)} className="flex items-center gap-1 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}