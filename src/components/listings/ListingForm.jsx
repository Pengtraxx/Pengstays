import React, { useState } from "react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImagePlus, X } from "lucide-react";
import { Image } from "@/components/ui/image";
import { AFRICAN_COUNTRIES, STATES_BY_COUNTRY } from "@/lib/locations";
import { CATEGORY_LABELS } from "@/lib/plans";

export default function ListingForm({ allowedCategories, defaultWhatsapp, onSubmit, submitting, initialData, submitLabel }) {
  const [form, setForm] = useState(() => ({
    title: "", description: "", category: allowedCategories[0], price: "",
    price_period: "per_month", country: "Nigeria", state: "", city: "",
    bedrooms: "", bathrooms: "", images: [], whatsapp_number: defaultWhatsapp || "",
    ...(initialData || {}),
    ...(initialData
      ? {
          price: initialData.price != null ? String(initialData.price) : "",
          bedrooms: initialData.bedrooms != null ? String(initialData.bedrooms) : "",
          bathrooms: initialData.bathrooms != null ? String(initialData.bathrooms) : "",
        }
      : {}),
  }));
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const states = STATES_BY_COUNTRY[form.country];

  const handleImages = async (e) => {
    const files = Array.from(e.target.files || []);
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

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      price: Number(form.price),
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Title</Label>
          <Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Luxury 3-Bedroom Apartment in Lekki" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedCategories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Price (₦)</Label>
            <Input required type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Per</Label>
            <Select value={form.price_period} onValueChange={(v) => set("price_period", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="per_year">Year</SelectItem>
                <SelectItem value="per_month">Month</SelectItem>
                <SelectItem value="per_night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.country} onValueChange={(v) => { set("country", v); set("state", ""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {AFRICAN_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>State / Region</Label>
          {states ? (
            <Select value={form.state} onValueChange={(v) => set("state", v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State / region" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>City / Area</Label>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Lekki Phase 1" />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp Number</Label>
          <Input required value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="+2348012345678" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Bedrooms</Label>
            <Input type="number" min="0" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bathrooms</Label>
            <Input type="number" min="0" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
          </div>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the property, amenities, and nearby attractions…" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Photos</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {form.images.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                <Image src={url} alt="" className="w-full h-full" />
                <button type="button" onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:border-emerald-700 hover:text-emerald-800 transition-colors">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              <span className="text-[10px] mt-1">{uploading ? "Uploading…" : "Add photos"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} disabled={uploading} />
            </label>
          </div>
        </div>
      </div>
      <Button type="submit" disabled={submitting || uploading} className="w-full sm:w-auto bg-emerald-900 hover:bg-emerald-800 rounded-full px-8">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {submitLabel || "Submit Listing"}
      </Button>
    </form>
  );
}