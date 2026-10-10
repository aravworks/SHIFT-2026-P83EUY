// deno-lint-ignore-file no-explicit-any
// Vehicle integration API, v1. Auth: `x-api-key` header (per-vehicle key issued by the admin portal).
//   POST   /vehicle/v1/telemetry        battery/position/temperature -> stored + server-side RangeCheck
//   POST   /vehicle/v1/events           vehicle-detected event (crash, stranded, thermal, other)
//   GET    /vehicle/v1/stations/nearby  stations with batteries available (stock minus holds)
//   POST   /vehicle/v1/reservations     ask a station to hold a swappable battery
//   GET    /vehicle/v1/reservations/:id
//   DELETE /vehicle/v1/reservations/:id cancel a hold
// Spec: docs/api/vehicle-api.yaml
import { adminClient, corsHeaders, json } from "../_shared/common.ts";
import { authVehicle } from "../_shared/auth.ts";
import { haversineKm, usableRangeKm } from "../_shared/geo.ts";

const EVENT_TYPES = ["crash", "stranded", "thermal", "other"];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Vehicle-originated alerts get a random id above 2^32 so they never collide with 32-bit mesh msgIds. */
function vehicleMsgId(): number {
  const r = crypto.getRandomValues(new Uint32Array(2));
  return 2 ** 32 + (r[0] % 2 ** 20) * 2 ** 20 + (r[1] % 2 ** 20);
}

/** One open alert per (vehicle, category): repeated telemetry does not spam the portal. */
async function raiseOnce(db: any, vehicle: any, category: string, lat: number | null, lon: number | null, priority: number | null) {
  const { data: open } = await db.from("alerts").select("msg_id")
    .eq("vehicle_id", vehicle.id).eq("category", category).eq("status", "open").limit(1);
  if (open?.length) return { raised: false, msg_id: open[0].msg_id as number };
  const msg_id = vehicleMsgId();
  const { error } = await db.from("alerts").insert({
    msg_id, category, priority, lat, lon, ingress: "vehicle", vehicle_id: vehicle.id,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { raised: true, msg_id };
}

async function telemetry(db: any, v: any, body: any) {
  if (!isNum(body.soc_pct) || body.soc_pct < 0 || body.soc_pct > 100) return json({ error: "soc_pct (0-100) is required" }, 400);
  const lat = isNum(body.lat) ? body.lat : null;
  const lon = isNum(body.lon) ? body.lon : null;
  const temp = isNum(body.temp_c) ? body.temp_c : null;
  const recordedAt = body.recorded_at ? new Date(body.recorded_at) : new Date();
  if (isNaN(recordedAt.getTime())) return json({ error: "recorded_at must be ISO 8601" }, 400);

  await db.from("vehicle_telemetry").insert({
    vehicle_id: v.id, soc_pct: body.soc_pct, voltage_v: isNum(body.voltage_v) ? body.voltage_v : null,
    temp_c: temp, lat, lon, speed_kmh: isNum(body.speed_kmh) ? body.speed_kmh : null,
    recorded_at: recordedAt.toISOString(),
  });
  await db.from("vehicles").update({
    last_soc: body.soc_pct, last_temp_c: temp, last_seen: new Date().toISOString(),
    ...(lat !== null && lon !== null ? { last_lat: lat, last_lon: lon } : {}),
  }).eq("id", v.id);

  const out: any = { ok: true, alerts: [] as unknown[] };
  const pos = lat !== null && lon !== null ? { lat, lon } : v.last_lat != null ? { lat: v.last_lat, lon: v.last_lon } : null;

  // Thermal: only if this vehicle has a configured limit. A threshold alert from BMS data, not fire detection.
  if (v.thermal_limit_c != null && temp !== null && temp >= v.thermal_limit_c) {
    out.alerts.push({ category: "thermal", ...(await raiseOnce(db, v, "thermal", pos?.lat ?? null, pos?.lon ?? null, null)) });
  }

  // RangeCheck: only if the profile and a position are known.
  if (v.km_per_pct != null && v.safety_margin != null && pos) {
    const range = usableRangeKm(body.soc_pct, v.km_per_pct, v.safety_margin);
    const { data: st } = await db.from("station_availability").select("id,name,lat,lon,available").gt("available", 0);
    const ranked = (st ?? []).map((s: any) => ({ ...s, distance_km: haversineKm(pos.lat, pos.lon, s.lat, s.lon) }))
      .sort((a: any, b: any) => a.distance_km - b.distance_km);
    const reachable = ranked.filter((s: any) => s.distance_km <= range);
    out.usable_range_km = range;
    out.reachable_stations = reachable;
    out.nearest_station_with_stock = ranked[0] ?? null;
    if (reachable.length === 0) {
      out.alerts.push({ category: "low_battery", ...(await raiseOnce(db, v, "low_battery", pos.lat, pos.lon, Math.floor(body.soc_pct / 10))) });
    }
  }
  return json(out);
}

async function events(db: any, v: any, body: any) {
  if (!EVENT_TYPES.includes(body.type)) return json({ error: `type must be one of ${EVENT_TYPES.join(", ")}` }, 400);
  const lat = isNum(body.lat) ? body.lat : v.last_lat;
  const lon = isNum(body.lon) ? body.lon : v.last_lon;
  if (lat == null || lon == null) return json({ error: "lat/lon required (no last known position)" }, 400);
  const msg_id = vehicleMsgId();
  const { error } = await db.from("alerts").insert({
    msg_id, category: body.type, lat, lon, ingress: "vehicle", vehicle_id: v.id,
    created_at: body.recorded_at ? new Date(body.recorded_at).toISOString() : new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, msg_id }, 201);
}

async function nearby(db: any, url: URL, v: any) {
  const lat = Number(url.searchParams.get("lat") ?? v.last_lat);
  const lon = Number(url.searchParams.get("lon") ?? v.last_lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat/lon required" }, 400);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 5) || 5, 20);
  const radius = url.searchParams.has("radius_km") ? Number(url.searchParams.get("radius_km")) : Infinity;
  const { data } = await db.from("station_availability").select("id,name,lat,lon,available,stock_updated_at");
  const stations = (data ?? []).map((s: any) => ({ ...s, distance_km: haversineKm(lat, lon, s.lat, s.lon) }))
    .filter((s: any) => s.distance_km <= radius)
    .sort((a: any, b: any) => a.distance_km - b.distance_km).slice(0, limit);
  return json({ stations });
}

async function reserve(db: any, v: any, body: any) {
  const minutes = Number(Deno.env.get("HOLD_MINUTES"));
  if (!Number.isFinite(minutes) || minutes <= 0) return json({ error: "HOLD_MINUTES secret is not configured" }, 500);
  if (typeof body.station_id !== "string") return json({ error: "station_id is required" }, 400);
  const { data: id, error } = await db.rpc("create_reservation", {
    p_station: body.station_id, p_vehicle: v.id, p_alert: isNum(body.alert_msg_id) ? body.alert_msg_id : null, p_minutes: minutes,
  });
  if (error) return json({ error: error.message }, error.code === "23505" ? 409 : error.code === "P0002" ? 404 : 500);
  if (!id) return json({ error: "no battery available at this station" }, 409);
  const { data: r } = await db.from("reservations").select("id,station_id,status,expires_at").eq("id", id).single();
  return json(r, 201);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = adminClient();
  const v = await authVehicle(req, db);
  if (!v) return json({ error: "invalid or missing x-api-key" }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/vehicle(?=\/|$)/, "").replace(/\/+$/, "");
  const body = req.method === "POST" ? await req.json().catch(() => null) : null;
  if (req.method === "POST" && !body) return json({ error: "JSON body required" }, 400);

  try {
    if (req.method === "POST" && path === "/v1/telemetry") return await telemetry(db, v, body);
    if (req.method === "POST" && path === "/v1/events") return await events(db, v, body);
    if (req.method === "GET" && path === "/v1/stations/nearby") return await nearby(db, url, v);
    if (req.method === "POST" && path === "/v1/reservations") return await reserve(db, v, body);

    const m = path.match(/^\/v1\/reservations\/([0-9a-f-]{36})$/);
    if (m) {
      await db.rpc("expire_reservations");
      const { data: r } = await db.from("reservations").select("id,station_id,status,expires_at").eq("id", m[1]).eq("vehicle_id", v.id).maybeSingle();
      if (!r) return json({ error: "not found" }, 404);
      if (req.method === "GET") return json(r);
      if (req.method === "DELETE") {
        if (r.status !== "held") return json({ error: `reservation is ${r.status}` }, 409);
        await db.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
        return json({ ...r, status: "cancelled" });
      }
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
