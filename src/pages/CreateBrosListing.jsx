import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ImagePlus, X, CreditCard } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Image } from "@/components/ui/image";
import { BROS_PRICE, hasActiveBrosSubscription, formatPrice } from "@/lib/plans";

export default function CreateBrosListing() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", price: "", images: [], whatsapp_number: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    db.auth.me()
      .then(setUser)
      .catch(() => db.auth.redirectToLogin("/da-bros/create"))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-800" /></div>;
  if (!user) return null;

  // Access (viewing + posting) requires the same active ₦20,000/14-day
  // subscription — enforced here and at the RLS level (bros_listings_insert).
  if (!hasActiveBrosSubscription(user)) {
    const payForAccess = async () => {
      setPayError("");
      setPaying(true);
      try {
        const res = await db.functions.invoke("flutterwave", {
          action: "initiate_bros",
          redirect_url: `${window.location.origin}/payment-callback`,
        });
        if (res.data?.link) window.location.href = res.data.link;
        else { setPayError(res.data?.error || "Could not start payment."); setPaying(false); }
      } catch (e) {
        setPayError(e.response?.data?.error || "Could not start payment.");
        setPaying(false);
      }
    };
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CreditCard className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="font-display text-3xl text-emerald-950">Get Da Bros access</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Posting to Da Bros needs active access — {formatPrice(BROS_PRICE)} every 14 days.
        </p>
        {payError && <p className="text-xs text-destructive mt-3">{payError}</p>}
        <Button onClick={payForAccess} disabled={paying} className="mt-6 bg-amber-400 text-emerald-950 hover:bg-amber-300 rounded-full px-8">
          {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Pay {formatPrice(BROS_PRICE)} with Flutterwave
        </Button>
      </div>
    );
  }

  const handleImages = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - form.images.length);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    set("images", [...form.images, ...urls]);
    setUploading(false);
  };

  const canSubmit = form.title.trim() && form.whatsapp_number.trim() && form.images.length >= 3 && form.images.length <= 4;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    await db.entities.BrosListing.create({
      title: form.title,
      description: form.description,
      price: form.price ? Number(form.price) : null,
      images: form.images,
      whatsapp_number: form.whatsapp_number,
    });
    navigate("/da-bros");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl text-emerald-950">Post to Da Bros</h1>
      <p className="text-muted-foreground text-sm mt-2">Access active until {user.bros_subscription_expires}.</p>
      <form onSubmit={submit} className="space-y-5 mt-6">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="What are you posting?" />
        </div>
        <div className="space-y-1.5">
          <Label>Price (₦, optional)</Label>
          <Input type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Leave blank if not for sale" />
        </div>
        <div className="space-y-1.5">
          <Label>Your WhatsApp Number</Label>
          <Input required value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="+2348012345678" />
          <p className="text-xs text-muted-foreground">Buyers chat with you directly — in-app and on WhatsApp.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Photos (3–4 required)</Label>
          <div className="grid grid-cols-4 gap-2">
            {form.images.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                <Image src={url} alt="" className="w-full h-full" />
                <button type="button" onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {form.images.length < 4 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:border-emerald-700 hover:text-emerald-800 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                <span className="text-[10px] mt-1">{uploading ? "Uploading…" : "Add photo"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} disabled={uploading} />
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{form.images.length}/4 photos added — at least 3 required.</p>
        </div>
        <Button type="submit" disabled={submitting || uploading || !canSubmit} className="w-full sm:w-auto bg-emerald-900 hover:bg-emerald-800 rounded-full px-8">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Post to Da Bros
        </Button>
      </form>
      <Link to="/da-bros" className="block text-sm text-muted-foreground hover:underline mt-4">← Back to Da Bros</Link>
    </div>
  );
}
