import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Auth vom aufrufenden User (kommt automatisch bei supabase.functions.invoke)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(jwt);
    const userId = u?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const { matchId } = await req.json();
    if (!matchId) return json({ error: "matchId required" }, 400);

    // Match gehört zum aufrufenden Arbeitgeber?
    const { data: match, error: mErr } = await sb
      .from("matches")
      .select("id, employer_id, employee_id, employer_unlocked, employer_payment_status, created_at")
      .eq("id", matchId)
      .single();
    if (mErr || !match || match.employer_id !== userId) {
      return json({ error: "forbidden" }, 403);
    }

    // Bereits unlocked? -> fertig
    if (match.employer_unlocked === true) {
      return json({ unlocked: true });
    }

    // === Regel v1: 1 kostenloses Unlock pro Monat ===
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);

    const { count } = await sb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("employer_id", userId)
      .eq("employer_unlocked", true)
      .gte("created_at", monthStart.toISOString());

    const FREE_UNLOCKS_PER_MONTH = 1;
    if ((count ?? 0) < FREE_UNLOCKS_PER_MONTH) {
      const { error: uErr } = await sb
        .from("matches")
        .update({ employer_unlocked: true, employer_payment_status: "free" })
        .eq("id", matchId);
      if (uErr) return json({ error: uErr.message }, 500);
      return json({ unlocked: true, mode: "free" });
    }

    // === sonst Payment nötig ===
    // TODO v2: aus stripe_price_map lesen; vorerst fix
    const amount_cents = 9900;
    return json({ unlocked: false, need_payment: true, amount_cents });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
