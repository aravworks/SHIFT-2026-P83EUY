// deno-lint-ignore-file no-explicit-any
// POST /help  { action?: "offer" | "withdraw", alert_msg_id, helper_node, eta_minutes?, sig }
// A rider phone (online, or via a station gateway) says it can help a stranded peer.
// Auth is demo-grade like the mesh packets: sig = hex HMAC-SHA256(GROUP_KEY, `help:<action>:<alert_msg_id>:<helper_node>`).
import { adminClient, corsHeaders, groupKey, json } from "../_shared/common.ts";
import { hmacHex, safeEqual } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const b = await req.json().catch(() => null);
  const action = b?.action ?? "offer";
  const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
  if (!b || !["offer", "withdraw"].includes(action) || !isInt(b.alert_msg_id) || !isInt(b.helper_node) || typeof b.sig !== "string") {
    return json({ error: "expected { action?, alert_msg_id, helper_node, eta_minutes?, sig }" }, 400);
  }
  if (b.helper_node < 1 || b.helper_node > 65535) return json({ error: "helper_node must be 1-65535" }, 400);
  if (b.eta_minutes !== undefined && (!isInt(b.eta_minutes) || b.eta_minutes < 0)) return json({ error: "eta_minutes must be >= 0" }, 400);

  const expected = await hmacHex(groupKey(), `help:${action}:${b.alert_msg_id}:${b.helper_node}`);
  if (!safeEqual(expected, b.sig.toLowerCase())) return json({ error: "bad signature" }, 401);

  const db: any = adminClient();
  const { data: alert } = await db.from("alerts").select("msg_id,status,origin_node").eq("msg_id", b.alert_msg_id).maybeSingle();
  if (!alert) return json({ error: "alert not found" }, 404);
  if (alert.status === "resolved") return json({ error: "alert is resolved" }, 409);
  if (alert.origin_node === b.helper_node) return json({ error: "a rider cannot help their own alert" }, 400);

  if (action === "withdraw") {
    const { error } = await db.from("help_offers").update({ status: "withdrawn" })
      .eq("alert_msg_id", b.alert_msg_id).eq("helper_node", b.helper_node);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  const { error } = await db.from("help_offers").upsert({
    alert_msg_id: b.alert_msg_id, helper_node: b.helper_node, eta_minutes: b.eta_minutes ?? null, status: "offered",
  }, { onConflict: "alert_msg_id,helper_node" });
  return error ? json({ error: error.message }, 500) : json({ ok: true }, 201);
});
