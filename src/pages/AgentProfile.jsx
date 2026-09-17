import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Phone, Building2, Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Image } from "@/components/ui/image";
import ListingCard from "@/components/listings/ListingCard";

export default function AgentProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.entities.AgentProfile.filter({ user_id: userId }),
      db.entities.Listing.filter({ created_by_id: userId, status: "approved" }, "-created_date", 100)
    ]).then(([ps, ls]) => {
      setProfile(ps[0] || null);
      setListings(ls);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;
  if (!profile) return <p className="text-center py-24 text-muted-foreground">Agent profile not found.</p>;

  const waNumber = (profile.whatsapp_number || "").replace(/[^0-9]/g, "");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="bg-[hsl(162,45%,10%)] text-white rounded-3xl p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-white/10 shrink-0">
          {profile.photo_url ? (
            <Image src={profile.photo_url} alt={profile.display_name} className="w-full h-full" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-3xl font-display text-amber-400">
              {profile.display_name?.[0]}
            </span>
          )}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h1 className="font-display text-3xl sm:text-4xl">{profile.display_name}</h1>
          {profile.agency_name && (
            <p className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-400 mt-1">
              <Building2 className="w-4 h-4" /> {profile.agency_name}
            </p>
          )}
          {profile.bio && <p className="text-white/70 text-sm mt-3 max-w-2xl">{profile.bio}</p>}
        </div>
        {waNumber && (
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-6 py-2.5 rounded-full font-medium hover:opacity-90 transition-opacity shrink-0">
            <Phone className="w-4 h-4" /> WhatsApp
          </a>
        )}
      </div>

      <h2 className="font-display text-2xl sm:text-3xl text-emerald-950 mt-10 mb-5">
        Listings by {profile.display_name} ({listings.length})
      </h2>
      {listings.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-16 border border-dashed rounded-2xl">No active listings yet.</p>
      )}
    </div>
  );
}