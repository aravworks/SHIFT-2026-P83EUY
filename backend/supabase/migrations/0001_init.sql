-- VoltMesh initial schema (see docs/backend.md)

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
  stock_version bigint,
  stock_updated_at timestamptz
);

create table alerts (
  msg_id bigint primary key,          -- generated on the origin phone
  origin_node int,                    -- no FK: alerts can arrive from nodes not yet provisioned
  category text check (category in ('low_battery','stranded','thermal','crash','other')),
  priority int,
  lat double precision, lon double precision,
  created_at timestamptz,
  received_at timestamptz default now(),
  ingress text check (ingress in ('direct','mesh')),
  gateway_node int,
  status text default 'open' check (status in ('open','help_sent','resolved')),
  bulk_uri text                       -- Supabase Storage path
);

create table relay_hops (
  msg_id bigint references alerts(msg_id) on delete cascade,
  node_id int,
  hop int,
  transport text check (transport in ('ble','wfd','gateway')),
  powered boolean,
  rssi int,
  received_at timestamptz,
  primary key (msg_id, node_id)
);

-- Anonymous mesh node IDs are 16 bits on the wire (originId / stationNodeId).
create sequence node_id_seq minvalue 1 maxvalue 65535 no cycle;

create function next_node_id() returns int
language sql security definer as $$ select nextval('node_id_seq')::int $$;
revoke all on function next_node_id() from public, anon, authenticated;

create index alerts_status_idx on alerts (status, received_at desc);

-- RLS: all writes go through Edge Functions (service role bypasses RLS).
alter table riders enable row level security;
alter table stations enable row level security;
alter table alerts enable row level security;
alter table relay_hops enable row level security;

-- Demo-grade: the read-only fleet dashboard uses the anon key.
-- Production: restrict to authenticated fleet users.
create policy "dashboard read stations" on stations for select using (true);
create policy "dashboard read alerts"   on alerts   for select using (true);
create policy "dashboard read hops"     on relay_hops for select using (true);
-- riders: no public read (display names); service role only.

-- Station and fleet roles may update alert status (help_sent / resolved).
create policy "station/fleet update alert status" on alerts for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('station','fleet'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('station','fleet'));

-- Realtime for the fleet dashboard
alter publication supabase_realtime add table alerts, relay_hops, stations;

-- Private bucket for Wi-Fi Direct bulk payloads
insert into storage.buckets (id, name, public) values ('bulk', 'bulk', false)
on conflict do nothing;
