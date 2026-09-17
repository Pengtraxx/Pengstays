import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import ListingForm from "@/components/listings/ListingForm";
import { PLANS, isAdmin, hasActiveSubscription } from "@/lib/plans";

const ALL_CATEGORIES = ["sale", "rent", "shortlet", "hotel", "land"];

export default function CreateListing() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    db.auth.me()
      .then(setUser)
      .catch(() => db.auth.redirectToLogin("/create"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;
  if (!user) return null;

  const admin = isAdmin(user);
  const subscribed = hasActiveSubscription(user);

  if (!admin && !subscribed) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl text-emerald-950">Subscription Required</h1>
        <p className="text-muted-foreground text-sm mt-3">
          To publish listings, choose a plan and complete payment via Flutterwave.
        </p>
        <Link to="/subscribe" className="inline-block mt-8 bg-emerald-900 text-white px-8 py-3 rounded-full font-medium hover:bg-emerald-800 transition-colors">
          Choose a Plan
        </Link>
      </div>
    );
  }

  const allowedCategories = admin ? ALL_CATEGORIES : (PLANS[user.plan]?.categories || ALL_CATEGORIES);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    await db.entities.Listing.create({
      ...data,
      owner_email: user.email,
      status: admin ? "approved" : "pending"
    });
    navigate("/dashboard");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl text-emerald-950 mb-2">Create a Listing</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {admin ? "As admin, your listing goes live immediately." : "Your listing will be reviewed and approved by our team before going live."}
      </p>
      <ListingForm
        allowedCategories={allowedCategories}
        defaultWhatsapp={user.whatsapp_number}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}