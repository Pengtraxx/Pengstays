import React, { useEffect, useState } from "react";
import { Loader2, CreditCard, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "@/api/supabaseClient";
import { formatPrice } from "@/lib/plans";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

export default function BookingsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.BookingRequest.list("-created_date", 500).then(setRequests).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-emerald-800 mx-auto my-10" />;

  const paidTotal = requests.filter((r) => r.paid).reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-2xl p-4 sm:p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <p className="font-display text-2xl text-emerald-950 leading-none">{formatPrice(paidTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total collected online across {requests.filter((r) => r.paid).length} paid bookings</p>
        </div>
      </div>

      {requests.length ? requests.map((r) => (
        <div key={r.id} className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{r.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full capitalize">{r.type}</span>
              {r.paid && (
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                  Paid {formatPrice(r.amount)}
                </span>
              )}
            </div>
            <Link to={`/listing/${r.listing_id}`} className="text-xs text-muted-foreground mt-0.5 hover:underline inline-flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> {r.listing_title} · {r.contact}
            </Link>
          </div>
        </div>
      )) : (
        <p className="text-muted-foreground text-center py-16 border border-dashed rounded-2xl">No booking or purchase requests yet.</p>
      )}
    </div>
  );
}
