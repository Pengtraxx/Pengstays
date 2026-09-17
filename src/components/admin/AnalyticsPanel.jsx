import React, { useEffect, useState } from "react";
import { Users, Eye, Radio, CalendarDays } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { db } from "@/api/supabaseClient";

const dayKey = (d) => d.toISOString().slice(0, 10);
const uniq = (arr, key) => new Set(arr.map((x) => x[key])).size;

export default function AnalyticsPanel() {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    db.entities.PageView.list("-created_date", 5000)
      .then(setViews)
      .finally(() => setLoading(false));

    const unsubscribe = db.entities.PageView.subscribe((event) => {
      if (event.type === "create") setViews((prev) => [event.data, ...prev]);
    });
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  if (loading) return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;

  const today = dayKey(new Date());
  const todayViews = views.filter((v) => v.day === today);
  const liveCutoff = now - 5 * 60 * 1000;
  const live = uniq(views.filter((v) => new Date(v.created_date).getTime() >= liveCutoff), "visitor_id");

  const days = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const k = dayKey(d);
    const rows = views.filter((v) => v.day === k);
    return { day: k.slice(5), visitors: uniq(rows, "visitor_id"), views: rows.length };
  });

  const stats = [
    { label: "Live now", value: live, sub: "active in last 5 min", icon: Radio, tone: "text-red-700 bg-red-50" },
    { label: "Visitors today", value: uniq(todayViews, "visitor_id"), sub: `${todayViews.length} page views`, icon: Users, tone: "text-emerald-800 bg-emerald-50" },
    { label: "Total visitors", value: uniq(views, "visitor_id"), sub: "all time (unique)", icon: CalendarDays, tone: "text-sky-800 bg-sky-50" },
    { label: "Total page views", value: views.length, sub: "all time", icon: Eye, tone: "text-amber-700 bg-amber-50" }
  ];

  const topPages = Object.entries(
    views.reduce((acc, v) => ({ ...acc, [v.path]: (acc[v.path] || 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, sub, icon: Icon, tone }) => (
          <div key={label} className="bg-card border rounded-2xl p-4 sm:p-5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${tone}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="font-display text-3xl text-emerald-950 leading-none">{value}</p>
            <p className="text-sm text-foreground/80 mt-1.5">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-medium mb-4">Daily visitors — last 14 days</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              <Bar dataKey="visitors" fill="hsl(162,45%,20%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-medium mb-3">Most visited pages</p>
        {topPages.length ? (
          <div className="space-y-2">
            {topPages.map(([path, count]) => (
              <div key={path} className="flex justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className="truncate text-foreground/85">{path}</span>
                <span className="text-muted-foreground shrink-0 ml-3">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No traffic recorded yet.</p>
        )}
      </div>
    </div>
  );
}