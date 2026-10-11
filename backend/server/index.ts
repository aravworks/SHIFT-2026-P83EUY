// Standalone Node server for the VoltMesh API (Render, or anywhere that runs Node >= 22.18).
// It loads the same handlers that deploy to Supabase Edge Functions: each function module calls
// Deno.serve(handler) once, so we provide a small Deno shim that captures the handler by name.
import { createServer } from "node:http";

type Handler = (req: Request) => Response | Promise<Response>;

const NAMES = ["provision", "ingest", "sos", "vehicle", "admin", "help"];
const MAX_BODY = 10 * 1024 * 1024; // bulk payloads are base64 in JSON

const handlers = new Map<string, Handler>();
let loading = "";
(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (k: string) => process.env[k] },
  serve: (h: Handler) => {
    handlers.set(loading, h);
  },
};

for (const name of NAMES) {
  loading = name;
  await import(`../supabase/functions/${name}/index.ts`);
}

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROUP_KEY", "HOLD_MINUTES"];
const missingEnv = () => REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv().length) console.warn(`Missing environment variables: ${missingEnv().join(", ")}`);

const port = Number(process.env.PORT ?? 8787);

createServer(async (nreq, nres) => {
  try {
    const url = new URL(nreq.url ?? "/", `http://${nreq.headers.host ?? "localhost"}`);

    if (url.pathname === "/healthz" || url.pathname === "/") {
      nres.writeHead(200, { "Content-Type": "application/json" });
      nres.end(JSON.stringify({ ok: true, service: "voltmesh-backend", functions: NAMES, missing_env: missingEnv() }));
      return;
    }

    // Accept both /<fn>/... and the Supabase-style /functions/v1/<fn>/...
    const path = url.pathname.replace(/^\/functions\/v1/, "");
    const name = path.split("/")[1];
    const handler = handlers.get(name);
    if (!handler) {
      nres.writeHead(404, { "Content-Type": "application/json" });
      nres.end(JSON.stringify({ error: "not found" }));
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of nreq) {
      size += (c as Buffer).length;
      if (size > MAX_BODY) {
        nres.writeHead(413, { "Content-Type": "application/json" });
        nres.end(JSON.stringify({ error: "body too large" }));
        return;
      }
      chunks.push(c as Buffer);
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(nreq.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const hasBody = !["GET", "HEAD"].includes(nreq.method ?? "GET");
    const req = new Request(url.origin + path + url.search, {
      method: nreq.method,
      headers,
      body: hasBody && chunks.length ? Buffer.concat(chunks) : undefined,
    });

    const res = await handler(req);
    nres.writeHead(res.status, Object.fromEntries(res.headers));
    nres.end(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error(e);
    const missing = missingEnv();
    nres.writeHead(500, { "Content-Type": "application/json" });
    nres.end(JSON.stringify({ error: "internal error", ...(missing.length ? { missing_env: missing } : {}) }));
  }
}).listen(port, () => console.log(`voltmesh-backend listening on :${port}`));
