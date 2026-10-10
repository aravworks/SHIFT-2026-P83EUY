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
- Demo-grade security, disclosed: shared group key, functions without JWT verification, anon-readable alerts/stations/hops for the dashboard.
- Not implemented yet: ACK handling, station `help_sent` UI wiring, per-device keys.
