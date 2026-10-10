// deno-lint-ignore-file no-explicit-any

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Device API keys look like vm_<64 hex>. Only the SHA-256 is stored. */
export function newApiKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return "vm_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Resolve the calling vehicle from the `x-api-key` header, or null. */
export async function authVehicle(req: Request, db: any) {
  const key = req.headers.get("x-api-key");
  if (!key) return null;
  const { data } = await db.from("vehicles").select("*")
    .eq("api_key_hash", await sha256Hex(key)).eq("active", true).maybeSingle();
  return data ?? null;
}

/** True when the Bearer token belongs to a user whose app_metadata.role is "admin". */
export async function requireAdmin(req: Request, db: any): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await db.auth.getUser(token);
  return !error && data.user?.app_metadata?.role === "admin";
}
