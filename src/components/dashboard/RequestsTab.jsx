import React from "react";
import { CalendarDays, Check, X, CreditCard } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/plans";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800"
};

export default function RequestsTab({ requests, setRequests }) {
  const setStatus = async (r, status) => {
    await db.entities.BookingRequest.update(r.id, { status });
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
  };

  if (!requests.length) {
    return (
      <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No booking or inspection requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{r.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full capitalize">{r.type}</span>
              {r.paid && (
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Paid {formatPrice(r.amount)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Re: {r.listing_title} · {r.contact} · {r.start_date}{r.end_date ? ` → ${r.end_date}` : ""}
            </p>
            {r.note && <p className="text-sm mt-1.5 text-foreground/85">{r.note}</p>}
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => setStatus(r, "confirmed")} className="bg-emerald-800 hover:bg-emerald-700 rounded-full">
                <Check className="w-4 h-4 mr-1" /> Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(r, "declined")} className="text-destructive border-destructive/40 rounded-full">
                <X className="w-4 h-4 mr-1" /> Decline
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}