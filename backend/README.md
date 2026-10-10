# VoltMesh Backend

New Supabase project (Postgres, Edge Functions, Realtime, Storage). No Sentinel code, data or keys. Schema and API are specified in [`../docs/backend.md`](../docs/backend.md).

```
backend/
  .env.example
  supabase/
    config.toml
    migrations/0001_init.sql     tables, node-id sequence, RLS, realtime, 'bulk' bucket
    functions/
      _shared/                   packet decoder + tag check, upsert logic, helpers
      provision/                 POST: assign node ID, return group key
      ingest/                    POST: gateway upload of alerts/warnings/stock
      sos/                       POST: direct SOS from an online rider phone
```

## Run locally

Needs the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```bash
cd backend
cp .env.example .env            # set GROUP_KEY
supabase start                  # applies migrations
supabase functions serve --env-file .env
```

Link to a hosted project: `supabase link --project-ref <ref>`, `supabase db push`, `supabase secrets set --env-file .env`, `supabase functions deploy`.

## Status and caveats

- Scaffold only; not yet run against a database. Task V03 stays open until `provision`, `ingest` and `sos` are tested end to end.
- `_shared/packet.ts` must stay byte-compatible with the Android `PacketCodec` (V04). The packet type numbers and the tag's input bytes (msgId, originId, createdAt, lat, lon, category/priority; HMAC-SHA256 truncated to 3 bytes) are my assumptions, since the spec leaves them open. Agree them with the mesh track and change both sides together.
- Demo-grade security, disclosed: shared group key, mesh functions (`provision`, `ingest`, `sos`) without JWT verification. (Dashboard reads now require login; see below.)
- Not implemented yet: ACK handling, station `help_sent` UI wiring, per-device keys.

## Vehicle API and admin (migration 0003)

- `functions/vehicle/` is the vehicle-facing API (per-vehicle `x-api-key`); `functions/admin/` provisions and rotates vehicle keys (admin JWT). See `../docs/vehicle-integration.md` and `../docs/api/vehicle-api.yaml`.
- Portal access is role-based: `auth.users.raw_app_meta_data.role` = `admin`, `fleet` or `station`. Migration 0003 removes the anonymous read policies from the earlier demo, so the dashboard now requires login.
- Required secret: `HOLD_MINUTES` (battery hold duration; no default on purpose).

## Live deployment (Supabase project `voltmesh`, ref `vjoveulhzwpgkveausvt`)

- Migrations 0001-0004 applied by hand in the SQL editor. The live `alerts` table has extra constraints not in `0001` (priority 0-15, lat/lon pair, per-field checks); treat the live schema as the source of truth.
- Functions deployed (`supabase functions deploy --use-api`): `provision`, `ingest`, `sos`, `vehicle`, `admin`.
- Secrets set: `GROUP_KEY` (random, demo-grade), `HOLD_MINUTES=30`.
- Verified with a test vehicle: input validation, telemetry storage, vehicle events, 404/401 paths. Not yet verified: range-check alerts and battery holds (need a station + vehicle profile), signed mesh packets, the portal UI, realtime.
- Known gaps: see the dry-run list (open `provision`, no replay/rate limits, expired holds not auto-flipped).

## Run on Render (or any Node host)

`backend/package.json` + `server/` turn the same function sources into one Node service (`npm start`, Node >= 22.18). `server/index.ts` loads the five handlers through a tiny Deno shim, so the Supabase Edge deployment and the Render service run identical code. Routes work with or without the `/functions/v1` prefix; `GET /healthz` is the health check.

Render setup (also described in `../render.yaml`):

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm install` (or `yarn`) |
| Start command | `npm start` |
| Health check path | `/healthz` |
| Env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_KEY`, `HOLD_MINUTES` (enter the secrets in the Render dashboard) |

Notes: Render must be connected to the GitHub repo (its log said it could not access it). On the free plan the service sleeps when idle, so the first request after a pause is slow; vehicles and the portal should tolerate that. To use it from the portal, set `VITE_API_URL=https://<service>.onrender.com` when building the dashboard.
