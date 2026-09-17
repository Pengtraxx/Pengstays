import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import BookingRequestForm from "@/components/listings/BookingRequestForm";
import { MapPin, BedDouble, Bath, Phone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, PERIOD_LABELS, formatPrice, ADMIN_EMAIL, whatsappLink } from "@/lib/plans";

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImg, setMainImg] = useState(0);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [agent, setAgent] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    db.entities.Listing.get(id).then(async (l) => {
      setListing(l);
      if (l?.created_by_id) {
        const profiles = await db.entities.AgentProfile.filter({ user_id: l.created_by_id });
        setAgent(profiles[0] || null);
      }
    }).catch(() => {}).finally(() => setLoading(false));
    // No login required to chat — we just personalize the form if they happen to be signed in.
    db.auth.me().then(setUser).catch(() => setUser(null));
  }, [id]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-20"><div className="h-72 bg-muted rounded-2xl animate-pulse" /></div>;
  if (!listing) return <p className="text-center py-24 text-muted-foreground">Listing not found.</p>;

  const images = listing.images?.length ? listing.images :
    ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80"];
  const isSale = listing.category === "sale";
  const waMsg = `Hi HSPR ADMIN, I'd like to ${isSale ? "buy" : "book"} this listing: "${listing.title}" (${formatPrice(listing.price)}${PERIOD_LABELS[listing.price_period] || ""}) — ${window.location.href}`;
  const waLink = whatsappLink(waMsg);

  const senderName = user?.full_name || user?.email || guestName;
  const senderContact = user?.email || guestContact;
  const canSend = message.trim() && (user || (guestName.trim() && guestContact.trim()));

  const sendMessage = async () => {
    if (!canSend) return;
    setSending(true);
    await db.entities.Message.create({
      listing_id: listing.id,
      listing_title: listing.title,
      to_user_id: listing.created_by_id,
      sender_name: senderName,
      sender_contact: senderContact,
      content: message
    });
    const recipients = new Set([ADMIN_EMAIL]);
    if (listing.owner_email) recipients.add(listing.owner_email);
    await Promise.all(
      [...recipients].map((to) =>
        db.integrations.Core.SendEmail({
          to,
          from_name: "PengStays",
          subject: `New inquiry on "${listing.title}"`,
          body: `${senderName} (${senderContact}) sent an inquiry on "${listing.title}":\n\n"${message}"\n\nListing: ${window.location.origin}/listing/${listing.id}`,
        }).catch(() => {})
      )
    );
    setSending(false);
    setSent(true);
    setMessage("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="rounded-2xl overflow-hidden aspect-[16/9]">
        <Image src={images[mainImg]} alt={listing.title} className="w-full h-full" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button key={url} onClick={() => setMainImg(i)}
              className={`w-20 h-16 rounded-lg overflow-hidden shrink-0 border-2 ${i === mainImg ? "border-emerald-800" : "border-transparent"}`}>
              <Image src={url} alt="" className="w-full h-full" />
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2">
          <span className="text-xs bg-emerald-950 text-amber-400 px-3 py-1 rounded-full">{CATEGORY_LABELS[listing.category]}</span>
          <h1 className="font-display text-3xl sm:text-4xl text-emerald-950 mt-3">{listing.title}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground mt-2">
            <MapPin className="w-4 h-4" />
            {[listing.city, listing.state, listing.country].filter(Boolean).join(", ")}
          </p>
          <div className="flex gap-5 mt-4 text-sm text-foreground/80">
            {listing.bedrooms != null && <span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" />{listing.bedrooms} bedrooms</span>}
            {listing.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" />{listing.bathrooms} bathrooms</span>}
          </div>
          {listing.description && (
            <p className="mt-6 text-foreground/80 leading-relaxed whitespace-pre-line">{listing.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border rounded-2xl p-5">
            <p className="font-display text-3xl text-emerald-900">
              {formatPrice(listing.price)}
              <span className="text-sm text-muted-foreground font-body">{PERIOD_LABELS[listing.price_period] || ""}</span>
            </p>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-full py-2.5 font-medium hover:opacity-90 transition-opacity">
              <Phone className="w-4 h-4" /> {isSale ? "Buy" : "Book"} via WhatsApp
            </a>
          </div>
          <div className="bg-card border rounded-2xl p-5">
            <h3 className="font-medium mb-3">Message the owner</h3>
            {sent ? (
              <p className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle2 className="w-4 h-4" /> Message sent!</p>
            ) : (
              <>
                {!user && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your name"
                      className="text-sm border rounded-lg px-3 py-2 bg-background"
                    />
                    <input
                      value={guestContact}
                      onChange={(e) => setGuestContact(e.target.value)}
                      placeholder="Phone or email"
                      className="text-sm border rounded-lg px-3 py-2 bg-background"
                    />
                  </div>
                )}
                <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi, I'm interested in this property…" />
                <Button onClick={sendMessage} disabled={sending || !canSend} className="w-full mt-3 bg-emerald-900 hover:bg-emerald-800 rounded-full">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Message
                </Button>
              </>
            )}
          </div>
          <BookingRequestForm listing={listing} />
          {agent && (
            <Link to={`/agent/${listing.created_by_id}`} className="flex items-center gap-3 bg-card border rounded-2xl p-4 hover:border-emerald-800/50 transition-colors">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted shrink-0">
                {agent.photo_url ? (
                  <Image src={agent.photo_url} alt="" className="w-full h-full" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center font-display text-emerald-900">{agent.display_name?.[0]}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{agent.display_name}</p>
                <p className="text-xs text-muted-foreground">{agent.agency_name || "View agent profile"} →</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}