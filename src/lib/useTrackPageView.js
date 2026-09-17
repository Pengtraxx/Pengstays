import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { db } from "@/api/supabaseClient";

const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getId(storage, key) {
  let v = storage.getItem(key);
  if (!v) {
    v = id();
    storage.setItem(key, v);
  }
  return v;
}

export default function useTrackPageView() {
  const location = useLocation();

  useEffect(() => {
    const visitor_id = getId(localStorage, "ps_visitor_id");
    const session_id = getId(sessionStorage, "ps_session_id");
    db.entities.PageView.create({
      path: location.pathname,
      day: new Date().toISOString().slice(0, 10),
      visitor_id,
      session_id,
      referrer: document.referrer || ""
    }).catch(() => {});
  }, [location.pathname]);
}