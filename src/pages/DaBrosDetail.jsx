import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, MessageCircle } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Image } from "@/components/ui/image";
import BrosChat from "@/components/dabros/BrosChat";
import { formatPrice, hasActiveBrosSubscription } from "@/lib/plans";

export default function DaBrosDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [listing, setListing] = useState(null);
  const [mainImg, setMainImg] = useState(0);

  useEffect(() => {
    db.auth.me()
      .then((u) => { setUser(u); return db.entities.BrosListing.get(id); })
      .then((l) => setListing(l))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, [id]);

  if (!checked) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;

  if (!hasActiveBrosSubscription(user)) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl">Da Bros access needed</h1>
        <p className="text-muted-foreground text-sm mt-2">This is a paid, members-only section.</p>
        <Link to="/da-bros" className="inline-block mt-6 bg-emerald-900 text-white px-6 py-3 rounded-full font-medium hover:bg-emerald-800 transition-colors">
          Get Access
        </Link>
      </div>
    );
  }

  if (!listing) return <p className="text-center py-24 text-muted-foreground">Post not found.</p>;

  const images = listing.images?.length ? listing.images :
    ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80"];
  const waNumber = (listing.whatsapp_number || "").replace(/[^0-9]/g, "");
  const waMsg = `Hi! I saw your Da Bros post "${listing.title}" on PengStays — ${window.location.href}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid lg:grid-cols-[1.4fr,1fr] gap-8">
      <div>
        <div className="aspect-square rounded-2xl overflow-hidden bg-muted">
          <Image src={images[mainImg]} alt={listing.title} className="w-full h-full" />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 mt-2">
            {images.map((img, i) => (
              <button key={i} onClick={() => setMainImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${i === mainImg ? "border-emerald-800" : "border-transparent"}`}>
                <Image src={img} alt="" className="w-full h-full" />
              </button>
            ))}
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-3xl text-emerald-950 mt-5">{listing.title}</h1>
        {listing.price != null && <p className="font-display text-xl text-emerald-800 mt-1">{formatPrice(listing.price)}</p>}
        <p className="text-foreground/80 mt-4 whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>
      </div>

      <div className="space-y-4">
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-full py-2.5 font-medium hover:opacity-90 transition-opacity"
          >
            <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
          </a>
        )}
        <BrosChat listingId={listing.id} otherUserId={listing.created_by_id} currentUserId={user.id} />
      </div>
    </div>
  );
}
