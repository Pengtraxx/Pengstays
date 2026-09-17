import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { isAdmin } from "@/lib/plans";
import useTrackPageView from "@/lib/useTrackPageView";
import MarqueeBar from "@/components/MarqueeBar";
import LiveActivityToast from "@/components/LiveActivityToast";

const NAV = [
  { label: "For Sale", to: "/listings?category=sale" },
  { label: "For Rent", to: "/listings?category=rent" },
  { label: "Shortlets", to: "/listings?category=shortlet" },
  { label: "Hotels", to: "/listings?category=hotel" },
  { label: "Land", to: "/listings?category=land" },
  { label: "Da Bros", to: "/da-bros" },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  useTrackPageView();

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => setUser(null));
  }, [location.pathname]);

  useEffect(() => { setOpen(false); }, [location]);

  const handleLogout = () => {
    setUser(null);
    db.auth.logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarqueeBar />
      <header className="sticky top-0 z-50 bg-[hsl(162,45%,10%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-icon.png" alt="PengStays" className="h-10 w-auto object-contain" />
            <span className="font-display text-xl sm:text-2xl tracking-tight">
              Peng<span className="text-amber-400">Stays</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {NAV.map((n) => (
              <Link key={n.label} to={n.to} className="text-white/80 hover:text-amber-400 transition-colors">
                {n.label}
              </Link>
            ))}
            {user && <Link to="/dashboard" className="text-white/80 hover:text-amber-400 transition-colors">Dashboard</Link>}
            {isAdmin(user) && <Link to="/admin" className="text-amber-400 hover:text-amber-300 transition-colors">Admin</Link>}
            {user ? (
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/80 hover:text-amber-400 transition-colors">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            ) : (
              <Link to="/login" className="flex items-center gap-1.5 text-white/80 hover:text-amber-400 transition-colors">
                <UserIcon className="w-4 h-4" /> Log in
              </Link>
            )}
            <Link to="/subscribe" className="bg-amber-400 text-emerald-950 px-4 py-2 rounded-full font-medium hover:bg-amber-300 transition-colors">
              List your property
            </Link>
          </nav>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-white/10 px-4 pb-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <Link key={n.label} to={n.to} className="py-2.5 text-white/85">{n.label}</Link>
            ))}
            {user && <Link to="/dashboard" className="py-2.5 text-white/85">Dashboard</Link>}
            {isAdmin(user) && <Link to="/admin" className="py-2.5 text-amber-400">Admin</Link>}
            {user ? (
              <button onClick={handleLogout} className="py-2.5 text-white/85 text-left flex items-center gap-1.5">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            ) : (
              <Link to="/login" className="py-2.5 text-white/85 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" /> Log in
              </Link>
            )}
            <Link to="/subscribe" className="mt-2 bg-amber-400 text-emerald-950 px-4 py-2.5 rounded-full font-medium text-center">
              List your property
            </Link>
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="bg-[hsl(162,45%,10%)] text-white/60 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="PengStays" className="h-12 w-auto object-contain" />
            <div>
              <p className="font-display text-lg text-white">Peng<span className="text-amber-400">Stays</span></p>
              <p className="text-white/50 text-xs sm:text-sm">Homes, Shortlets, Hotels & Land — anywhere in Africa</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p>© {new Date().getFullYear()} PengStays. All rights reserved.</p>
            <p className="text-amber-400/80 mt-1">A Product of HSPR TECHNOLOGIES</p>
          </div>
        </div>
      </footer>
      <LiveActivityToast />
    </div>
  );
}