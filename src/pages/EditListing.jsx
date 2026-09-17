import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { db } from "@/api/supabaseClient";
import ListingForm from "@/components/listings/ListingForm";
import { isAdmin } from "@/lib/plans";

const ALL_CATEGORIES = ["sale", "rent", "shortlet", "hotel", "land"];

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.auth.me()
      .then(async (u) => {
        setUser(u);
        const l = await db.entities.Listing.get(id);
        setListing(l);
      })
      .catch(() => db.auth.redirectToLogin(`/edit/${id}`))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;
  if (!listing) return <p className="text-center py-24 text-muted-foreground">Listing not found.</p>;

  const canEdit = user && (isAdmin(user) || listing.created_by_id === user.id);
  if (!canEdit) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-3xl">Not your listing</h1>
        <p className="text-muted-foreground text-sm mt-2">Only the owner or a PengStays admin can edit this listing.</p>
        <Link to={`/listing/${id}`} className="inline-block mt-6 text-emerald-800 hover:underline text-sm">← Back to listing</Link>
      </div>
    );
  }

  const handleSubmit = async (data) => {
    setSubmitting(true);
    await db.entities.Listing.update(id, data);
    navigate(isAdmin(user) ? "/admin" : "/dashboard");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl text-emerald-950 mb-2">Edit Listing</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Update the price, details, or photos — useful once you've struck a deal directly with the property or confirmed current rates.
      </p>
      <ListingForm
        allowedCategories={ALL_CATEGORIES}
        initialData={listing}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Save Changes"
      />
    </div>
  );
}
