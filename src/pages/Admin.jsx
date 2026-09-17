import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, ShieldCheck, Check, X, Trash2, Pencil, Star, StarOff, Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import ExportPanel from "@/components/admin/ExportPanel";
import AdsPanel from "@/components/admin/AdsPanel";
import BookingsPanel from "@/components/admin/BookingsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { CATEGORY_LABELS, formatPrice, isAdmin } from "@/lib/plans";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.auth.me().then(async (u) => {
      setUser(u);
      if (isAdmin(u)) {
        const ls = await db.entities.Listing.list("-created_date", 300);
        setListings(ls);
      }
      setLoading(false);
    }).catch(() => db.auth.redirectToLogin("/admin"));
  }, []);

  const setStatus = async (id, status) => {
    await db.entities.Listing.update(id, { status });
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this listing permanently? This can't be undone.")) return;
    await db.entities.Listing.delete(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  // Admin has full rights — boosting is free and instant, no Flutterwave
  // payment needed (that flow is for regular sellers, see Dashboard.jsx).
  const isCurrentlyFeatured = (l) =>
    l.featured && l.featured_expires && new Date(l.featured_expires) >= new Date();

  const toggleBoost = async (l) => {
    if (isCurrentlyFeatured(l)) {
      await db.entities.Listing.update(l.id, { featured: false, featured_expires: null });
      setListings((prev) => prev.map((x) => x.id === l.id ? { ...x, featured: false, featured_expires: null } : x));
    } else {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      await db.entities.Listing.update(l.id, { featured: true, featured_expires: expires });
      setListings((prev) => prev.map((x) => x.id === l.id ? { ...x, featured: true, featured_expires: expires } : x));
    }
  };

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;

  if (!isAdmin(user)) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-3xl">Access Denied</h1>
        <p className="text-muted-foreground text-sm mt-2">This area is reserved for the PengStays administrator.</p>
      </div>
    );
  }

  const pending = listings.filter((l) => l.status === "pending");

  const Row = ({ l }) => (
    <div className="flex gap-3 sm:gap-4 border rounded-2xl p-3 sm:p-4 items-center">
      <div className="w-20 h-16 sm:w-28 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
        {l.images?.[0] && <Image src={l.images[0]} alt="" className="w-full h-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/listing/${l.id}`} className="font-medium text-sm sm:text-base hover:underline line-clamp-1">{l.title}</Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {CATEGORY_LABELS[l.category]} · {formatPrice(l.price)} · {[l.state, l.country].filter(Boolean).join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">{l.owner_email} · <span className="capitalize">{l.status}</span>{isCurrentlyFeatured(l) && <span className="text-amber-600"> · ★ Featured until {l.featured_expires}</span>}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <Link to={`/edit/${l.id}`}>
          <Button size="sm" variant="outline" className="rounded-full w-full">
            <Pencil className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Edit</span>
          </Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleBoost(l)}
          className={`rounded-full ${isCurrentlyFeatured(l) ? "text-amber-700 border-amber-400" : "text-emerald-800 border-emerald-800/40"}`}
        >
          {isCurrentlyFeatured(l) ? <StarOff className="w-4 h-4 sm:mr-1" /> : <Star className="w-4 h-4 sm:mr-1" />}
          <span className="hidden sm:inline">{isCurrentlyFeatured(l) ? "Unboost" : "Boost Free"}</span>
        </Button>
        {l.status !== "approved" && (
          <Button size="sm" onClick={() => setStatus(l.id, "approved")} className="bg-emerald-800 hover:bg-emerald-700 rounded-full">
            <Check className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Approve</span>
          </Button>
        )}
        {l.status !== "rejected" && (
          <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "rejected")} className="text-destructive border-destructive/40 rounded-full">
            <X className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Reject</span>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => remove(l.id)} className="text-destructive border-destructive/40 rounded-full">
          <Trash2 className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Delete</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-emerald-950">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Full control: approve, delete, boost, and run ads across PengStays.</p>
        </div>
        <Link to="/create" className="inline-flex items-center gap-2 bg-emerald-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-emerald-800 transition-colors w-fit">
          <Plus className="w-4 h-4" /> New Listing (any category)
        </Link>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="all">All Listings ({listings.length})</TabsTrigger>
          <TabsTrigger value="bookings">Bookings & Payments</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="export" className="mt-6">
          <ExportPanel />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <AnalyticsPanel />
        </TabsContent>
        <TabsContent value="pending" className="mt-6 space-y-3">
          {pending.length ? pending.map((l) => <Row key={l.id} l={l} />) : (
            <p className="text-muted-foreground text-center py-16 border border-dashed rounded-2xl">No listings awaiting approval.</p>
          )}
        </TabsContent>
        <TabsContent value="all" className="mt-6 space-y-3">
          {listings.length ? listings.map((l) => <Row key={l.id} l={l} />) : (
            <p className="text-muted-foreground text-center py-16 border border-dashed rounded-2xl">No listings yet.</p>
          )}
        </TabsContent>
        <TabsContent value="bookings" className="mt-6">
          <BookingsPanel />
        </TabsContent>
        <TabsContent value="ads" className="mt-6">
          <AdsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
