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

export type StaffRole = "admin" | "fleet" | "station";

/** The caller's staff role (from the Supabase user JWT's app_metadata.role) if it is one of `allowed`, else null. */
export async function requireRole(req: Request, db: any, allowed: StaffRole[]): Promise<StaffRole | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  const role = data?.user?.app_metadata?.role as StaffRole | undefined;
  return !error && role && allowed.includes(role) ? role : null;
}

/** True when the Bearer token belongs to a user whose app_metadata.role is "admin". */
export async function requireAdmin(req: Request, db: any): Promise<boolean> {
  return (await requireRole(req, db, ["admin"])) === "admin";
}

/** Hex HMAC-SHA256, used to authenticate phones that hold the shared group key (demo-grade, disclosed). */
export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
