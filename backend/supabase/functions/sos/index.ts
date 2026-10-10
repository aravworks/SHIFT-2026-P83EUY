// POST /functions/v1/sos  { packet_hex, bulk_base64? }
// Direct path for a rider phone with internet. Same msg_id as the mesh copies, so they dedup.
import { adminClient, corsHeaders, groupKey, json } from "../_shared/common.ts";
import { ingestItem } from "../_shared/ingest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => null);
  if (!body?.packet_hex) return json({ error: "expected { packet_hex }" }, 400);

  const r = await ingestItem(
    adminClient(),
    { packet_hex: body.packet_hex, ingress: "direct", bulk_base64: body.bulk_base64 },
    groupKey(),
    null,
  );
  return json(r, r.ok ? 200 : 400);
});
