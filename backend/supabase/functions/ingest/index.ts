// POST /functions/v1/ingest  { gateway_node?: number, items: Item[] }
// Any gateway (station or online phone) uploads carried alerts, warnings and station stock.
import { adminClient, corsHeaders, groupKey, json } from "../_shared/common.ts";
import { ingestItem, type Item } from "../_shared/ingest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return json({ error: "expected { items: [...] }" }, 400);
  if (body.items.length > 100) return json({ error: "max 100 items per call" }, 413);

  const db = adminClient();
  const key = groupKey();
  const results = [];
  for (const item of body.items as Item[]) {
    results.push(await ingestItem(db, item, key, body.gateway_node ?? null));
  }
  return json({ results });
});
