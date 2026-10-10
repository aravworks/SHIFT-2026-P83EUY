import { supabase } from "./supabase";

const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export const functionsBase = `${base}/functions/v1`;

/** Call an Edge Function as the signed-in user. */
export async function callFunction<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase!.auth.getSession();
  const res = await fetch(`${functionsBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}
