-- Vehicle integration API + admin portal support (docs/vehicle-integration.md)

-- Staff roles live in the JWT: auth.users.raw_app_meta_data -> {"role": "admin" | "fleet" | "station"}
create or replace function app_role() returns text
language sql stable as $$ select auth.jwt() -> 'app_metadata' ->> 'role' $$;

-- ───────── Lock the admin portal behind login (replaces the anon-read demo policies) ─────────
drop policy "dashboard read stations" on stations;
drop policy "dashboard read alerts" on alerts;
drop policy "dashboard read hops" on relay_hops;

create policy "staff read stations" on stations for select to authenticated
  using (app_role() in ('admin','fleet','station'));
create policy "staff read alerts" on alerts for select to authenticated
  using (app_role() in ('admin','fleet','station'));
create policy "staff read hops" on relay_hops for select to authenticated
  using (app_role() in ('admin','fleet','station'));

revoke execute on function alert_clusters(double precision, int, boolean) from public, anon;
revoke execute on function map_grid_clusters(int, int, boolean) from public, anon;

-- Status changes only: nothing else on alerts is editable from the portal.
drop policy "station/fleet update alert status" on alerts;
revoke update on alerts from anon, authenticated;
grant update (status) on alerts to authenticated;
create policy "staff update alert status" on alerts for update to authenticated
  using (app_role() in ('admin','fleet','station'))
  with check (app_role() in ('admin','fleet','station'));

-- ───────── Alerts may now originate from a vehicle ─────────
alter table alerts drop constraint alerts_ingress_check;
alter table alerts add constraint alerts_ingress_check check (ingress in ('direct','mesh','vehicle'));

-- ───────── Vehicles ─────────
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  make text,
  model text,
  fleet text,
  rider_id uuid references riders(id) on delete set null,
  api_key_hash text not null unique,           -- sha256 of the device API key; the key itself is shown once
  active boolean not null default true,
  -- Per-scooter profile. NULL = the feature is off for this vehicle (no invented defaults).
  km_per_pct double precision check (km_per_pct > 0),
  safety_margin double precision check (safety_margin >= 0 and safety_margin < 1),
  thermal_limit_c double precision,
  -- Latest known state
  last_soc double precision,
  last_temp_c double precision,
  last_lat double precision,
  last_lon double precision,
  last_seen timestamptz,
  created_at timestamptz default now()
);

alter table alerts add column vehicle_id uuid references vehicles(id) on delete set null;
create index alerts_vehicle_idx on alerts (vehicle_id, category, status);

create table vehicle_telemetry (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  soc_pct double precision check (soc_pct between 0 and 100),
  voltage_v double precision,
  temp_c double precision,
  lat double precision,
  lon double precision,
  speed_kmh double precision,
  recorded_at timestamptz not null,
  received_at timestamptz default now()
);
create index vehicle_telemetry_idx on vehicle_telemetry (vehicle_id, recorded_at desc);

-- ───────── Battery holds (stranded protection) ─────────
create table reservations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  alert_msg_id bigint references alerts(msg_id) on delete set null,
  status text not null default 'held' check (status in ('held','picked_up','expired','cancelled')),
  created_at timestamptz default now(),
  expires_at timestamptz not null
);
create index reservations_station_idx on reservations (station_id, status, expires_at);

create function expire_reservations() returns void
language sql as $$ update reservations set status = 'expired' where status = 'held' and expires_at <= now() $$;

-- Atomic hold: locks the station row so two vehicles cannot claim the last battery.
-- Returns the reservation id, or NULL when no battery is available.
create function create_reservation(p_station uuid, p_vehicle uuid, p_alert bigint, p_minutes int)
returns uuid language plpgsql as $$
declare v_stock int; v_held int; v_id uuid;
begin
  perform expire_reservations();
  select coalesce(batteries_available, 0) into v_stock from stations where id = p_station for update;
  if not found then raise exception 'unknown station' using errcode = 'P0002'; end if;
  if p_vehicle is not null and exists (select 1 from reservations where vehicle_id = p_vehicle and status = 'held') then
    raise exception 'vehicle already has an active hold' using errcode = '23505';
  end if;
  select count(*) into v_held from reservations where station_id = p_station and status = 'held';
  if v_stock - v_held <= 0 then return null; end if;
  insert into reservations (station_id, vehicle_id, alert_msg_id, expires_at)
    values (p_station, p_vehicle, p_alert, now() + make_interval(mins => p_minutes))
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function expire_reservations() from public, anon, authenticated;
revoke execute on function create_reservation(uuid, uuid, bigint, int) from public, anon, authenticated;

-- Stock minus active holds.
create view station_availability with (security_invoker = true) as
select s.id, s.name, s.node_id, s.lat, s.lon, s.batteries_available, s.stock_version, s.stock_updated_at,
       coalesce(h.n, 0)::int as held_count,
       greatest(coalesce(s.batteries_available, 0) - coalesce(h.n, 0), 0)::int as available
from stations s
left join (
  select station_id, count(*) as n from reservations
  where status = 'held' and expires_at > now() group by station_id
) h on h.station_id = s.id;

-- ───────── RLS ─────────
alter table vehicles enable row level security;
alter table vehicle_telemetry enable row level security;
alter table reservations enable row level security;

-- vehicles: the key hash is never readable by portal users (column-level grants).
revoke all on vehicles from anon, authenticated;
grant select (id, label, make, model, fleet, rider_id, active, km_per_pct, safety_margin, thermal_limit_c,
              last_soc, last_temp_c, last_lat, last_lon, last_seen, created_at) on vehicles to authenticated;
grant update (label, make, model, fleet, active, km_per_pct, safety_margin, thermal_limit_c) on vehicles to authenticated;
create policy "staff read vehicles" on vehicles for select to authenticated using (app_role() in ('admin','fleet'));
create policy "admin update vehicles" on vehicles for update to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

revoke all on vehicle_telemetry from anon, authenticated;
grant select on vehicle_telemetry to authenticated;
create policy "staff read telemetry" on vehicle_telemetry for select to authenticated using (app_role() in ('admin','fleet'));

revoke all on reservations from anon, authenticated;
grant select on reservations to authenticated;
grant update (status) on reservations to authenticated;
create policy "staff read reservations" on reservations for select to authenticated
  using (app_role() in ('admin','fleet','station'));
create policy "staff close reservations" on reservations for update to authenticated
  using (app_role() in ('admin','fleet','station'))
  with check (status in ('picked_up','cancelled'));

grant select on station_availability to authenticated;

alter publication supabase_realtime add table reservations;
