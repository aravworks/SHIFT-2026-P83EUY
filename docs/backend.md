# Backend (new Supabase project)

Holds riders, stations, alerts and relay hops. Gateway uploads go through one Edge Function that verifies the tag; Realtime pushes changes to the fleet dashboard. No Sentinel tables, users or keys.

## Tables

```sql
create table riders (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  node_id int unique,                 -- anonymous mesh ID
  fleet text,
  created_at timestamptz default now()
);

create table stations (
  id uuid primary key default gen_random_uuid(),
  name text,
  node_id int unique,
  lat double precision, lon double precision,
  batteries_available int,
  stock_version int,
  stock_updated_at timestamptz
);

create table alerts (
  msg_id bigint primary key,          -- generated on the origin phone
  origin_node int references riders(node_id),
  category text,                      -- low_battery | stranded | thermal | crash | other
  priority int,
  lat double precision, lon double precision,
  created_at timestamptz,
  received_at timestamptz default now(),
  ingress text,                       -- direct | mesh
  gateway_node int,
  status text default 'open',         -- open | help_sent | resolved
  bulk_uri text                       -- Supabase Storage path
);

create table relay_hops (
  msg_id bigint references alerts(msg_id),
  node_id int,
  hop int,
  transport text,                     -- ble | wfd | gateway
  powered boolean,
  rssi int,
  received_at timestamptz,
  primary key (msg_id, node_id)
);
```

## APIs

| Endpoint | Caller | Does |
|----------|--------|------|
| `POST /functions/v1/provision` | App, first launch while online | Assigns node ID, returns group key |
| `POST /functions/v1/ingest` | Any gateway (station or online phone) | Verifies tag, upserts alert on `msg_id`, inserts hops, stores bulk |
| `POST /functions/v1/sos` | Rider phone with internet | Direct path; same `msg_id`, dedups with mesh copies |
| `PATCH alerts.status` (RLS: station + fleet roles) | Station, fleet | `help_sent`, `resolved` |
| Realtime on `alerts`, `relay_hops` | Fleet dashboard | Live map and path updates |

## App <-> backend

- Provisioning on first launch while online: node ID and group key.
- Gateway uploads carried alerts, warnings and station stock to `ingest` when online or in station mode, then floods an ACK.
- An online rider phone also sends its own SOS straight to `sos` with the same `msgId`.
- The fleet dashboard only reads (Realtime on alerts, stations, relay_hops).
