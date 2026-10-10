// POST /functions/v1/provision  { role: "rider"|"station", name?, fleet?, lat?, lon? }
// Assigns a node ID and returns the group key (demo-grade shared key).
import { adminClient, corsHeaders, groupKey, json } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const role = body.role === "station" ? "station" : "rider";
  const db = adminClient();

  const { data: nodeId, error: idErr } = await db.rpc("next_node_id");
  if (idErr) return json({ error: idErr.message }, 500);

  const { error } = role === "station"
    ? await db.from("stations").insert({
      name: body.name, node_id: nodeId, lat: body.lat, lon: body.lon, batteries_available: 0, stock_version: 0,
    })
    : await db.from("riders").insert({ display_name: body.name, node_id: nodeId, fleet: body.fleet });
  if (error) return json({ error: error.message }, 500);

  return json({ node_id: nodeId, group_key: groupKey(), role });
});
