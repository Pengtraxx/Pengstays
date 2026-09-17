import React, { useState, useEffect } from "react";
import { CalendarDays, Loader2, CheckCircle2, MessageCircle, CreditCard } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_EMAIL, formatPrice, whatsappLink } from "@/lib/plans";

export default function BookingRequestForm({ listing }) {
  const isStay = listing.category === "shortlet" || listing.category === "hotel";
  const isSale = listing.category === "sale";
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ type: isStay ? "booking" : "inspection", start_date: "", end_date: "", note: "", guest_name: "", guest_contact: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // No login required to browse, chat, request, or pay — we just
  // personalize the form if the visitor happens to already be signed in.
  useEffect(() => { db.auth.me().then(setUser).catch(() => setUser(null)); }, []);

  const name = user?.full_name || user?.email || form.guest_name;
  const contact = user?.email || form.guest_contact;
  const canSubmit = form.start_date && name.trim() && contact.trim();
  const canPay = user || (form.guest_name.trim() && form.guest_contact.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    await db.entities.BookingRequest.create({
      listing_id: listing.id,
      listing_title: listing.title,
      to_user_id: listing.created_by_id,
      name,
      contact,
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date,
      note: form.note,
    });

    const when = form.end_date ? `${form.start_date} → ${form.end_date}` : form.start_date;
    const body =
      `${name} has requested ${form.type === "booking" ? "a booking" : "an inspection"} for "${listing.title}".\n\n` +
      `Date: ${when}\nContact: ${contact}\n` +
      (form.note ? `Note: ${form.note}\n` : "") +
      `\nListing: ${window.location.origin}/listing/${listing.id}`;

    // The admin sees every request, no matter who owns the listing.
    const recipients = new Set([ADMIN_EMAIL]);
    if (listing.owner_email) recipients.add(listing.owner_email);
    await Promise.all(
      [...recipients].map((to) =>
        db.integrations.Core.SendEmail({
          to,
          from_name: "PengStays",
          subject: `New ${form.type} request for "${listing.title}"`,
          body,
        }).catch(() => {})
      )
    );

    setSending(false);
    setSent(true);
  };

  const handleWhatsApp = () => {
    const url = `${window.location.origin}/listing/${listing.id}`;
    const msg = `Hi HSPR ADMIN, I'd like to ${isStay ? "book" : "inspect"} "${listing.title}" (${formatPrice(listing.price)}) — ${url}`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  };

  // Guests can pay too — Flutterwave just needs an email/name for the
  // customer record, which we collect inline (no account required).
  const payOnline = async () => {
    if (!canPay) return;
    setPayError("");
    setPaying(true);
    try {
      const res = await db.functions.invoke("flutterwave", {
        action: "initiate_booking",
        listing_id: listing.id,
        redirect_url: `${window.location.origin}/payment-callback`,
        ...(user ? {} : { guest_name: form.guest_name.trim(), guest_email: form.guest_contact.trim() }),
      });
      if (res.data?.link) {
        window.location.href = res.data.link;
      } else {
        setPayError(res.data?.error || "Could not start payment.");
        setPaying(false);
      }
    } catch (e) {
      setPayError(e.response?.data?.error || "Could not start payment.");
      setPaying(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-5 space-y-3">
      {!user && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.guest_name} onChange={(e) => set("guest_name", e.target.value)} placeholder="Your name" className="text-sm" />
          <Input type="email" value={form.guest_contact} onChange={(e) => set("guest_contact", e.target.value)} placeholder="Your email" className="text-sm" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleWhatsApp} className="w-full bg-[#25D366] hover:opacity-90 rounded-full text-sm">
          <MessageCircle className="w-4 h-4 mr-1.5" /> {isSale ? "Buy" : "Book"} via WhatsApp
        </Button>
        <Button onClick={payOnline} disabled={paying || !canPay} variant="outline" className="w-full rounded-full text-sm border-emerald-800 text-emerald-900">
          {paying ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CreditCard className="w-4 h-4 mr-1.5" />}
          Pay Online
        </Button>
      </div>
      {payError && <p className="text-xs text-destructive">{payError}</p>}
      {!user && !canPay && (
        <p className="text-xs text-muted-foreground">Add your name and email above to pay online.</p>
      )}

      {sent ? (
        <p className="flex items-center gap-2 text-emerald-700 text-sm pt-1">
          <CheckCircle2 className="w-4 h-4" /> Request sent! The owner and PengStays admin have been notified.
        </p>
      ) : (
        <>
          <h3 className="font-medium flex items-center gap-2 pt-1"><CalendarDays className="w-4 h-4 text-emerald-800" /> Or request {isStay ? "a booking" : "an inspection"}</h3>
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inspection">Property Inspection</SelectItem>
              <SelectItem value="booking">Stay Booking</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{form.type === "booking" ? "Check-in" : "Date"}</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            {form.type === "booking" && (
              <div className="space-y-1">
                <Label className="text-xs">Check-out</Label>
                <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
              </div>
            )}
          </div>
          <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Any details or questions…" />
          <Button onClick={submit} disabled={sending || !canSubmit} className="w-full bg-emerald-900 hover:bg-emerald-800 rounded-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send Request
          </Button>
        </>
      )}
    </div>
  );
}
