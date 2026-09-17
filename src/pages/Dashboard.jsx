import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Inbox, Trash2, Pencil, Loader2, Star } from "lucide-react";
import AgentStats from "@/components/dashboard/AgentStats";
import RequestsTab from "@/components/dashboard/RequestsTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
import { db } from "@/api/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ListingCard from "@/components/listings/ListingCard";
import { PLANS, hasActiveSubscription } from "@/lib/plans";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800"
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [boosting, setBoosting] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.auth.me().then(async (u) => {
      setUser(u);
      const [ls, ms, rs] = await Promise.all([
        db.entities.Listing.filter({ created_by_id: u.id }, "-created_date", 100),
        db.entities.Message.filter({ to_user_id: u.id }, "-created_date", 100),
        db.entities.BookingRequest.filter({ to_user_id: u.id }, "-created_date", 100)
      ]);
      setListings(ls);
      setMessages(ms);
      setRequests(rs);
      setLoading(false);
    }).catch(() => db.auth.redirectToLogin("/dashboard"));
  }, []);

  const markRead = async (m) => {
    if (m.read) return;
    await db.entities.Message.update(m.id, { read: true });
    setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, read: true } : x));
  };

  const deleteListing = async (id) => {
    await db.entities.Listing.delete(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  const boost = async (id) => {
    setBoosting(id);
    const res = await db.functions.invoke("flutterwave", {
      action: "initiate",
      plan: "feature",
      listing_id: id,
      redirect_url: window.location.origin + "/payment-callback"
    });
    if (res.data?.link) window.location.href = res.data.link;
    else setBoosting(null);
  };

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-emerald-950">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasActiveSubscription(user)
              ? `${PLANS[user.plan]?.label} plan · active until ${user.subscription_expires}`
              : "No active subscription"}
          </p>
        </div>
        <Link to="/create" className="inline-flex items-center gap-2 bg-emerald-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-emerald-800 transition-colors w-fit">
          <Plus className="w-4 h-4" /> New Listing
        </Link>
      </div>

      <AgentStats listings={listings} requests={requests} />

      <Tabs defaultValue="listings">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="listings">My Listings ({listings.length})</TabsTrigger>
          <TabsTrigger value="messages">
            Messages {unread > 0 && <span className="ml-1.5 bg-emerald-800 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>}
          </TabsTrigger>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
          <TabsTrigger value="profile">Agent Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-6">
          {listings.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {listings.map((l) => (
                <div key={l.id} className="relative">
                  <ListingCard listing={l} />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                    <Link to={`/edit/${l.id}`} onClick={(e) => e.stopPropagation()} className="bg-white/90 text-emerald-800 rounded-full p-1.5 hover:bg-white" aria-label="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={() => deleteListing(l.id)} className="bg-white/90 text-destructive rounded-full p-1.5 hover:bg-white" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {l.status === "approved" && (
                    l.featured && l.featured_expires && new Date(l.featured_expires) >= new Date() ? (
                      <p className="mt-2 text-xs text-amber-600 flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Featured until {l.featured_expires}
                      </p>
                    ) : (
                      <button onClick={() => boost(l.id)} disabled={boosting === l.id}
                        className="mt-2 w-full text-xs border border-amber-500 text-amber-700 rounded-full py-1.5 hover:bg-amber-50 transition-colors">
                        {boosting === l.id ? "Redirecting…" : "★ Boost to homepage — ₦5,000 / 30 days"}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-16 border border-dashed rounded-2xl">You haven't posted any listings yet.</p>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          {messages.length ? (
            <div className="space-y-3">
              {messages.map((m) => (
                <button key={m.id} onClick={() => markRead(m)}
                  className={`w-full text-left border rounded-2xl p-4 transition-colors ${m.read ? "bg-card" : "bg-emerald-50 border-emerald-200"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">{m.sender_name}</p>
                    {!m.read && <Badge className="bg-emerald-800">New</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Re: {m.listing_title} · {m.sender_contact}</p>
                  <p className="text-sm mt-2 text-foreground/85">{m.content}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No messages yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <RequestsTab requests={requests} setRequests={setRequests} />
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}