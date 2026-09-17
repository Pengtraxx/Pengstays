import { supabase } from "@/lib/supabase";

/* ---------------------------------------------------------------------- */
/*  Generic entity helper — gives every table a small, consistent CRUD API */
/*  (list / filter / get / create / update / delete / subscribe) so the    */
/*  rest of the app can talk to Postgres without repeating query code.     */
/* ---------------------------------------------------------------------- */

// Supports the "-created_date" convention used across the app:
// a leading "-" means descending order.
function applyOrder(query, orderBy) {
  if (!orderBy) return query;
  const desc = orderBy.startsWith("-");
  const column = desc ? orderBy.slice(1) : orderBy;
  return query.order(column, { ascending: !desc });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

function makeEntity(table) {
  return {
    async list(orderBy = "-created_date", limit = 100) {
      let query = supabase.from(table).select("*");
      query = applyOrder(query, orderBy);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    async filter(filters = {}, orderBy = "-created_date", limit = 100) {
      let query = supabase.from(table).select("*");
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        query = query.eq(key, value);
      }
      query = applyOrder(query, orderBy);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const created_by_id = await currentUserId();
      const { data, error } = await supabase
        .from(table)
        .insert({ ...payload, ...(created_by_id ? { created_by_id } : {}) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    // Realtime insert subscription, mirroring the base44 `.subscribe()` shape
    // used by the live analytics panel. Requires the table to be added to
    // the `supabase_realtime` publication (see supabase/migrations).
    subscribe(callback) {
      const channel = supabase
        .channel(`realtime:${table}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table }, (payload) => {
          callback({ type: "create", data: payload.new });
        })
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

export const entities = {
  Listing: makeEntity("listings"),
  AgentProfile: makeEntity("agent_profiles"),
  Subscription: makeEntity("subscriptions"),
  PageView: makeEntity("page_views"),
  Message: makeEntity("messages"),
  BookingRequest: makeEntity("booking_requests"),
  Ad: makeEntity("ads"),
  BrosListing: makeEntity("bros_listings"),
  BrosMessage: makeEntity("bros_messages"),
};

/* ---------------------------------------------------------------------- */
/*  Auth                                                                   */
/* ---------------------------------------------------------------------- */

async function fetchProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

// If this user paid for Da Bros access as a guest (before they had an
// account), claim it now that they're signed in — matched by email via the
// "bros_subscriptions_claim" RLS policy. Cheap no-op if there's nothing to
// claim. Runs quietly; failures here shouldn't block login.
async function claimBrosSubscription(userId, email) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("bros_subscriptions")
      .update({ created_by_id: userId })
      .eq("payer_email", email)
      .is("created_by_id", null)
      .eq("status", "active")
      .gte("period_end", today)
      .select()
      .order("period_end", { ascending: false })
      .limit(1);
    const claimed = data?.[0];
    if (claimed) {
      await supabase
        .from("profiles")
        .upsert({ id: userId, bros_subscription_active: true, bros_subscription_expires: claimed.period_end });
    }
  } catch {
    // Nothing to claim, or RLS blocked it — fine either way.
  }
}

export const auth = {
  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }
    const user = data.user;
    await claimBrosSubscription(user.id, user.email);
    const profile = await fetchProfile(user.id);
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      role: profile?.role || "user",
      whatsapp_number: profile?.whatsapp_number || "",
      plan: profile?.plan || "",
      subscription_active: profile?.subscription_active || false,
      subscription_expires: profile?.subscription_expires || null,
      bros_subscription_active: profile?.bros_subscription_active || false,
      bros_subscription_expires: profile?.bros_subscription_expires || null,
    };
  },

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  },

  async updateMe(patch) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error("Not authenticated");
    const { error } = await supabase.from("profiles").upsert({ id: authData.user.id, ...patch });
    if (error) throw error;
    return true;
  },

  redirectToLogin(returnTo = "/") {
    window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },
};

/* ---------------------------------------------------------------------- */
/*  Edge Functions (Flutterwave payments, transactional email)             */
/* ---------------------------------------------------------------------- */

export const functions = {
  async invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      // supabase-js puts the raw Response on `error.context` for non-2xx
      // replies — pull the real `{ error: "..." }` body out of it so pages
      // that read `e.response.data.error` still get a useful message.
      let message = error.message || "Function call failed";
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // ignore — fall back to error.message
      }
      const err = new Error(message);
      err.response = { data: { error: message } };
      throw err;
    }
    return { data };
  },
};

/* ---------------------------------------------------------------------- */
/*  Storage / integrations                                                 */
/* ---------------------------------------------------------------------- */

const UPLOADS_BUCKET = "uploads";

export const integrations = {
  Core: {
    async UploadFile({ file }) {
      const ext = file.name?.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
      return { file_url: data.publicUrl };
    },

    // Sends transactional email via the `send-email` Supabase Edge Function.
    // Never blocks the UI — callers already treat this as best-effort.
    async SendEmail({ to, from_name, subject, body }) {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to, from_name, subject, body },
      });
      if (error) throw error;
      return true;
    },
  },
};

// Single default export mirroring the old `base44` object shape, so call
// sites can do `db.auth.me()`, `db.entities.Listing.create()`, etc.
export const db = { auth, entities, functions, integrations };
