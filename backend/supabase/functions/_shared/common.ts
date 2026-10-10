import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Service-role client: Edge Functions are the only writers. */
export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Demo-grade shared key (disclosed in docs/risks.md). Set with `supabase secrets set GROUP_KEY=...`. */
export function groupKey(): string {
  const k = Deno.env.get("GROUP_KEY");
  if (!k) throw new Error("GROUP_KEY secret not set");
  return k;
}
