import React from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircle } from "lucide-react";
import { Image } from "@/components/ui/image";
import { CATEGORY_LABELS, PERIOD_LABELS, formatPrice, whatsappLink } from "@/lib/plans";

export default function ListingCard({ listing }) {
  const img = listing.images?.[0] ||
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80";
  const isForSale = listing.category === "sale";
  const ctaLabel = isForSale ? "Buy" : "Book";

  const handleWhatsApp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/listing/${listing.id}`;
    const msg = `Hi HSPR ADMIN, I'd like to ${ctaLabel.toLowerCase()} this listing: "${listing.title}" (${formatPrice(listing.price)}${PERIOD_LABELS[listing.price_period] || ""}) — ${url}`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group h-full flex flex-col bg-card rounded-2xl overflow-hidden border border-border/60 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-800/30 transition-all duration-300 ease-out"
    >
      <div className="relative aspect-[4/3] overflow-hidden shrink-0">
        <Image src={img} alt={listing.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out" />
        <span className="absolute top-2 left-2 bg-emerald-950/85 text-amber-400 text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-medium tracking-wide">
          {CATEGORY_LABELS[listing.category]}
        </span>
        {listing.featured && (
          <span className="absolute top-2 right-2 bg-amber-400 text-emerald-950 text-[10px] px-2 py-1 rounded-full font-semibold">★ Featured</span>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3 className="font-medium text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-emerald-900 transition-colors">{listing.title}</h3>
        <p className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {[listing.city, listing.state, listing.country].filter(Boolean).join(", ")}
        </p>
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <p className="font-display text-base sm:text-lg text-emerald-900 truncate">
            {formatPrice(listing.price)}
            <span className="text-xs text-muted-foreground font-body">{PERIOD_LABELS[listing.price_period] || ""}</span>
          </p>
          <button
            onClick={handleWhatsApp}
            className="shrink-0 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors"
            aria-label={`${ctaLabel} via WhatsApp`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> {ctaLabel}
          </button>
        </div>
      </div>
    </Link>
  );
}