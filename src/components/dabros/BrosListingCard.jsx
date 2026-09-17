import React from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/plans";
import { Image } from "@/components/ui/image";

export default function BrosListingCard({ listing }) {
  const img = listing.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80";
  return (
    <Link
      to={`/da-bros/${listing.id}`}
      className="group h-full flex flex-col bg-card rounded-2xl overflow-hidden border border-border/60 hover:shadow-xl hover:-translate-y-1 hover:border-amber-500/40 transition-all duration-300 ease-out"
    >
      <div className="relative aspect-square overflow-hidden shrink-0">
        <Image src={img} alt={listing.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out" />
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-medium text-sm leading-snug line-clamp-1">{listing.title}</h3>
        {listing.price != null && (
          <p className="mt-auto pt-2 font-display text-emerald-900">{formatPrice(listing.price)}</p>
        )}
      </div>
    </Link>
  );
}
