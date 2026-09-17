import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Megaphone } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Image } from "@/components/ui/image";

const EMPTY = { title: "", subtitle: "", image_url: "", link_url: "" };

export default function AdsPanel() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.entities.Ad.list("-created_date", 100).then(setAds).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set("image_url", file_url);
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const ad = await db.entities.Ad.create({ ...form, active: true, sort_order: ads.length });
    setAds((prev) => [ad, ...prev]);
    setForm(EMPTY);
    setSaving(false);
  };

  const toggleActive = async (ad) => {
    const active = !ad.active;
    await db.entities.Ad.update(ad.id, { active });
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, active } : a)));
  };

  const remove = async (id) => {
    await db.entities.Ad.delete(id);
    setAds((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-emerald-800 mx-auto my-10" />;

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-4 sm:p-5 space-y-3">
        <h3 className="font-medium flex items-center gap-2"><Megaphone className="w-4 h-4 text-emerald-800" /> Run a new ad</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Prime Land in Lekki — Now Selling" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subtitle</Label>
            <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Short supporting line" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link URL (optional)</Label>
            <Input value={form.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="/listings?category=sale" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Banner image</Label>
            <Input type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
          </div>
        </div>
        {form.image_url && (
          <div className="w-full h-32 rounded-xl overflow-hidden bg-muted">
            <Image src={form.image_url} alt="" className="w-full h-full" />
          </div>
        )}
        <Button onClick={create} disabled={saving || uploading || !form.title.trim()} className="bg-emerald-900 hover:bg-emerald-800 rounded-full">
          {saving || uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Publish Ad
        </Button>
      </div>

      <div className="space-y-3">
        {ads.length ? ads.map((ad) => (
          <div key={ad.id} className="flex gap-3 border rounded-2xl p-3 items-center">
            <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
              {ad.image_url && <Image src={ad.image_url} alt="" className="w-full h-full" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-1">{ad.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{ad.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={ad.active} onCheckedChange={() => toggleActive(ad)} />
              <Button size="sm" variant="outline" onClick={() => remove(ad.id)} className="text-destructive border-destructive/40 rounded-full">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )) : (
          <p className="text-muted-foreground text-center py-10 border border-dashed rounded-2xl">No ads yet — publish one above.</p>
        )}
      </div>
    </div>
  );
}
