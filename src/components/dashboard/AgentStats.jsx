import React from "react";
import { Home, CalendarCheck, Clock, Star } from "lucide-react";

const CARD = "bg-card border rounded-2xl p-4 sm:p-5";

export default function AgentStats({ listings, requests }) {
  const active = listings.filter((l) => l.status === "approved").length;
  const pendingApprovals = listings.filter((l) => l.status === "pending").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const featured = listings.filter(
    (l) => l.featured && l.featured_expires && new Date(l.featured_expires) >= new Date()
  ).length;

  const stats = [
    { label: "Active listings", value: active, icon: Home, tone: "text-emerald-800 bg-emerald-50" },
    { label: "Booking requests", value: requests.length, sub: `${pendingRequests} awaiting your reply`, icon: CalendarCheck, tone: "text-sky-800 bg-sky-50" },
    { label: "Pending approvals", value: pendingApprovals, sub: "Under review by our team", icon: Clock, tone: "text-amber-700 bg-amber-50" },
    { label: "Featured listings", value: featured, icon: Star, tone: "text-yellow-700 bg-yellow-50" }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
      {stats.map(({ label, value, sub, icon: Icon, tone }) => (
        <div key={label} className={CARD}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${tone}`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="font-display text-3xl text-emerald-950 leading-none">{value}</p>
          <p className="text-sm text-foreground/80 mt-1.5">{label}</p>
          {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
        </div>
      ))}
    </div>
  );
}