import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { db } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A simple two-way chat thread scoped to one Da Bros listing, between the
// current viewer and the listing's owner. Realtime-updated via Postgres
// changes on bros_messages (see supabase/migrations/0002_da_bros.sql).
export default function BrosChat({ listingId, otherUserId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;
    let cancelled = false;

    db.entities.BrosMessage.filter({ listing_id: listingId }, "created_date", 200)
      .then((all) => {
        if (cancelled) return;
        setMessages(all.filter(
          (m) => (m.from_user_id === currentUserId && m.to_user_id === otherUserId) ||
                 (m.from_user_id === otherUserId && m.to_user_id === currentUserId)
        ));
      })
      .finally(() => !cancelled && setLoading(false));

    const channel = supabase
      .channel(`bros_chat:${listingId}:${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bros_messages", filter: `listing_id=eq.${listingId}` }, (payload) => {
        const m = payload.new;
        if ((m.from_user_id === currentUserId && m.to_user_id === otherUserId) ||
            (m.from_user_id === otherUserId && m.to_user_id === currentUserId)) {
          setMessages((prev) => [...prev, m]);
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [listingId, otherUserId, currentUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !currentUserId || !otherUserId) return;
    setSending(true);
    const content = text.trim();
    setText("");
    await db.entities.BrosMessage.create({
      listing_id: listingId,
      from_user_id: currentUserId,
      to_user_id: otherUserId,
      content,
    });
    setSending(false);
  };

  if (!otherUserId) return null;
  if (currentUserId === otherUserId) {
    return <p className="text-sm text-muted-foreground">This is your own listing.</p>;
  }

  return (
    <div className="flex flex-col border rounded-2xl overflow-hidden bg-card">
      <div className="px-4 py-2.5 border-b bg-muted/40 text-sm font-medium">In-app chat</div>
      <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto p-3 space-y-2">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-emerald-800 mx-auto my-6" />
        ) : messages.length ? (
          messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
              m.from_user_id === currentUserId
                ? "ml-auto bg-emerald-900 text-white rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            }`}>
              {m.content}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet — say hello 👋</p>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-2.5 border-t">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="bg-emerald-900 hover:bg-emerald-800 shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
