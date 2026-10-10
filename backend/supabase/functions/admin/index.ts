// deno-lint-ignore-file no-explicit-any
// Admin-only vehicle provisioning (Bearer = Supabase user JWT with app_metadata.role = "admin").
//   POST /admin/vehicles                 { label, make?, model?, fleet? } -> { id, api_key }  (key shown once)
//   POST /admin/vehicles/:id/rotate-key  -> { id, api_key }
import { adminClient, corsHeaders, json } from "../_shared/common.ts";
import { newApiKey, requireAdmin, sha256Hex } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db: any = adminClient();
  if (!(await requireAdmin(req, db))) return json({ error: "admin role required" }, 403);

  const path = new URL(req.url).pathname.replace(/^.*?\/admin(?=\/|$)/, "").replace(/\/+$/, "");

  if (path === "/vehicles") {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.label !== "string" || !body.label.trim()) return json({ error: "label is required" }, 400);
    const api_key = newApiKey();
    const { data, error } = await db.from("vehicles").insert({
      label: body.label.trim(), make: body.make ?? null, model: body.model ?? null, fleet: body.fleet ?? null,
      api_key_hash: await sha256Hex(api_key),
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);
    return json({ id: data.id, api_key }, 201);
  }

  const m = path.match(/^\/vehicles\/([0-9a-f-]{36})\/rotate-key$/);
  if (m) {
    const api_key = newApiKey();
    const { data, error } = await db.from("vehicles").update({ api_key_hash: await sha256Hex(api_key) })
      .eq("id", m[1]).select("id").maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "not found" }, 404);
    return json({ id: data.id, api_key });
  }
  return json({ error: "not found" }, 404);
});
