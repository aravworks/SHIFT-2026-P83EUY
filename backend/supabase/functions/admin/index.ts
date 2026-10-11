// deno-lint-ignore-file no-explicit-any
// Portal actions (Bearer = Supabase user JWT; role comes from app_metadata.role).
//   admin only:
//     POST /admin/vehicles                      { label, make?, model?, fleet? } -> { id, api_key }  (key shown once)
//     POST /admin/vehicles/:id/rotate-key       -> { id, api_key }
//   admin, fleet or station:
//     POST /admin/alerts/:msg_id/hold           { station_id } -> 201 reservation   ("Battery held")
//     POST /admin/stations/:id/stock            { delta } or { set } -> { batteries_available }
import { adminClient, corsHeaders, json } from "../_shared/common.ts";
import { newApiKey, requireRole, sha256Hex } from "../_shared/auth.ts";

const rpcStatus = (code?: string) =>
  code === "23505" ? 409 : code === "P0002" ? 404 : code === "23514" || code === "22003" ? 409 : 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db: any = adminClient();

  const path = new URL(req.url).pathname.replace(/^.*?\/admin(?=\/|$)/, "").replace(/\/+$/, "");
  const body = await req.json().catch(() => null);

  // ───────── admin only ─────────
  if (path === "/vehicles" || /^\/vehicles\/[0-9a-f-]{36}\/rotate-key$/.test(path)) {
    if (!(await requireRole(req, db, ["admin"]))) return json({ error: "admin role required" }, 403);

    if (path === "/vehicles") {
      if (!body || typeof body.label !== "string" || !body.label.trim()) return json({ error: "label is required" }, 400);
      const api_key = newApiKey();
      const { data, error } = await db.from("vehicles").insert({
        label: body.label.trim(), make: body.make || null, model: body.model || null, fleet: body.fleet || null,
        api_key_hash: await sha256Hex(api_key),
      }).select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ id: data.id, api_key }, 201);
    }

    const id = path.split("/")[2];
    const api_key = newApiKey();
    const { data, error } = await db.from("vehicles").update({ api_key_hash: await sha256Hex(api_key) })
      .eq("id", id).select("id").maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "not found" }, 404);
    return json({ id: data.id, api_key });
  }

  // ───────── staff (admin, fleet, station) ─────────
  const hold = path.match(/^\/alerts\/(\d+)\/hold$/);
  const stock = path.match(/^\/stations\/([0-9a-f-]{36})\/stock$/);
  if (!hold && !stock) return json({ error: "not found" }, 404);
  if (!(await requireRole(req, db, ["admin", "fleet", "station"]))) return json({ error: "staff role required" }, 403);

  if (hold) {
    const msgId = Number(hold[1]);
    if (!body || typeof body.station_id !== "string") return json({ error: "station_id is required" }, 400);
    const minutes = Number(Deno.env.get("HOLD_MINUTES"));
    if (!Number.isFinite(minutes) || minutes <= 0) return json({ error: "HOLD_MINUTES is not configured" }, 500);

    const { data: alert } = await db.from("alerts").select("msg_id,vehicle_id,status").eq("msg_id", msgId).maybeSingle();
    if (!alert) return json({ error: "alert not found" }, 404);
    if (alert.status === "resolved") return json({ error: "alert is resolved" }, 409);

    await db.rpc("expire_reservations");
    const { data: existing } = await db.from("reservations").select("id").eq("alert_msg_id", msgId).eq("status", "held").limit(1);
    if (existing?.length) return json({ error: "this alert already has an active hold" }, 409);

    const { data: id, error } = await db.rpc("create_reservation", {
      p_station: body.station_id, p_vehicle: alert.vehicle_id, p_alert: msgId, p_minutes: minutes,
    });
    if (error) return json({ error: error.message }, rpcStatus(error.code));
    if (!id) return json({ error: "no battery available at this station" }, 409);
    const { data: r } = await db.from("reservations").select("id,station_id,alert_msg_id,status,expires_at").eq("id", id).single();
    return json(r, 201);
  }

  // stock
  const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
  if (!body || (!isInt(body.delta) && !isInt(body.set))) return json({ error: "delta or set (integer) is required" }, 400);
  const { data, error } = await db.rpc("adjust_station_stock", {
    p_station: stock![1], p_delta: isInt(body.delta) ? body.delta : null, p_set: isInt(body.set) ? body.set : null,
  });
  if (error) return json({ error: error.message }, rpcStatus(error.code));
  return json({ batteries_available: data });
});
