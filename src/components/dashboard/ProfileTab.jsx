import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, ExternalLink, Camera } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/ui/image";

export default function ProfileTab({ user }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ display_name: "", agency_name: "", bio: "", photo_url: "", whatsapp_number: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  useEffect(() => {
    db.entities.AgentProfile.filter({ user_id: user.id }).then((ps) => {
      if (ps[0]) {
        setProfile(ps[0]);
        setForm({
          display_name: ps[0].display_name || "",
          agency_name: ps[0].agency_name || "",
          bio: ps[0].bio || "",
          photo_url: ps[0].photo_url || "",
          whatsapp_number: ps[0].whatsapp_number || user.whatsapp_number || ""
        });
      } else {
        setForm((f) => ({ ...f, display_name: user.full_name || "", whatsapp_number: user.whatsapp_number || "" }));
      }
      setLoading(false);
    });
  }, [user]);

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    set("photo_url", file_url);
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const data = { ...form, user_id: user.id, user_email: user.email };
    if (profile) {
      await db.entities.AgentProfile.update(profile.id, data);
    } else {
      const created = await db.entities.AgentProfile.create(data);
      setProfile(created);
    }
    setSaving(false);
    setSaved(true);
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-800" /></div>;

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-4">
        <label className="relative w-20 h-20 rounded-full overflow-hidden bg-muted cursor-pointer group shrink-0">
          {form.photo_url ? (
            <Image src={form.photo_url} alt="" className="w-full h-full" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-muted-foreground"><Camera className="w-6 h-6" /></span>
          )}
          <span className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs">
            {uploading ? "…" : "Change"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
        </label>
        <p className="text-sm text-muted-foreground">Your public agent profile — visible to buyers and guests on all your listings.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Display Name</Label>
        <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="e.g. Samuel Ivere" />
      </div>
      <div className="space-y-1.5">
        <Label>Agency Name (optional)</Label>
        <Input value={form.agency_name} onChange={(e) => set("agency_name", e.target.value)} placeholder="e.g. Ivere Realty Ltd" />
      </div>
      <div className="space-y-1.5">
        <Label>WhatsApp Number</Label>
        <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="+2348012345678" />
      </div>
      <div className="space-y-1.5">
        <Label>About You</Label>
        <Textarea rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Tell buyers about your experience, areas you cover, and services you offer…" />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={saving || !form.display_name.trim()} className="bg-emerald-900 hover:bg-emerald-800 rounded-full px-8">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {saved ? "Saved!" : "Save Profile"}
        </Button>
        {profile && (
          <Link to={`/agent/${user.id}`} className="text-sm text-emerald-800 hover:underline flex items-center gap-1">
            View public profile <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}