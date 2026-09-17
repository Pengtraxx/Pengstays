import React, { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";

const cell = (v) => {
  const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const download = (name, rows) => {
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const LISTING_COLS = ["id", "title", "category", "price", "price_period", "country", "state", "city",
  "bedrooms", "bathrooms", "status", "featured", "featured_expires", "owner_email", "whatsapp_number",
  "images", "description", "created_date"];

const AGENT_COLS = ["id", "display_name", "agency_name", "user_email", "whatsapp_number", "user_id", "bio", "created_date"];

export default function ExportPanel() {
  const [busy, setBusy] = useState(null);

  const run = async (kind) => {
    setBusy(kind);
    try {
      if (kind === "listings") {
        const rows = await db.entities.Listing.list("-created_date", 5000);
        download("pengstays-listings", [LISTING_COLS, ...rows.map((r) => LISTING_COLS.map((c) => r[c]))]);
      } else {
        const rows = await db.entities.AgentProfile.list("-created_date", 5000);
        download("pengstays-agents", [AGENT_COLS, ...rows.map((r) => AGENT_COLS.map((c) => r[c]))]);
      }
    } finally {
      setBusy(null);
    }
  };

  const Card = ({ kind, title, desc }) => (
    <div className="bg-card border rounded-2xl p-5 flex flex-col">
      <FileSpreadsheet className="w-8 h-8 text-emerald-800 mb-3" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 flex-1">{desc}</p>
      <Button onClick={() => run(kind)} disabled={!!busy}
        className="mt-4 rounded-full bg-emerald-900 hover:bg-emerald-800 w-fit">
        {busy === kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export CSV
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card kind="listings" title="All listings" desc="Every listing with pricing, location, status, owner contact and images." />
        <Card kind="agents" title="All agents" desc="Agent profiles with agency, email, WhatsApp number and bio." />
      </div>
      <p className="text-xs text-muted-foreground">
        Open in Google Sheets: File → Import → Upload, then choose the downloaded CSV.
      </p>
    </div>
  );
}