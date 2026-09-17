import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Image } from "@/components/ui/image";
import { coordsForListing } from "@/lib/countryCoords";
import { formatPrice, PERIOD_LABELS } from "@/lib/plans";

export default function ListingsMap({ listings }) {
  const points = useMemo(() => {
    const seen = {};
    return listings
      .map((l) => {
        const key = `${l.country}|${l.state || ""}`;
        const i = seen[key] = (seen[key] ?? -1) + 1;
        const pos = coordsForListing(l, i);
        return pos ? { listing: l, pos } : null;
      })
      .filter(Boolean);
  }, [listings]);

  return (
    <div className="rounded-2xl overflow-hidden border h-[70vh] min-h-[420px]">
      <MapContainer center={[2, 19]} zoom={3} scrollWheelZoom className="w-full h-full" style={{ background: "#e8eee9" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(({ listing, pos }) => (
          <CircleMarker
            key={listing.id}
            center={pos}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: listing.featured ? "#f59e0b" : "#065f46",
              fillOpacity: 1
            }}
          >
            <Popup>
              <Link to={`/listing/${listing.id}`} className="block w-44">
                <Image src={listing.images?.[0]} alt={listing.title} className="w-full h-24 rounded-lg mb-2" />
                <p className="font-medium text-sm leading-tight">{listing.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[listing.city, listing.state, listing.country].filter(Boolean).join(", ")}
                </p>
                <p className="text-sm font-semibold text-emerald-900 mt-1">
                  {formatPrice(listing.price)}{PERIOD_LABELS[listing.price_period] || ""}
                </p>
              </Link>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}