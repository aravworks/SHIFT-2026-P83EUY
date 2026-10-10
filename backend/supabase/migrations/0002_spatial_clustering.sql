-- Spatial clustering for the fleet dashboard map (docs/database-clustering.md)

create extension if not exists postgis with schema extensions;

-- Point geometry derived from lat/lon (SRID 4326), kept in sync automatically.
alter table alerts   add column if not exists geom extensions.geometry(Point, 4326)
  generated always as (extensions.ST_SetSRID(extensions.ST_MakePoint(lon, lat), 4326)) stored;
alter table stations add column if not exists geom extensions.geometry(Point, 4326)
  generated always as (extensions.ST_SetSRID(extensions.ST_MakePoint(lon, lat), 4326)) stored;

create index if not exists alerts_geom_idx   on alerts   using gist (geom);
create index if not exists stations_geom_idx on stations using gist (geom);

-- 1) Density clustering (DBSCAN): "which alerts belong to the same incident area?"
--    eps_m is metres in Web Mercator (EPSG:3857), so distances are stretched by 1/cos(lat)
--    (about 1.4x at 45 degrees; fine for a map heuristic, not for surveying).
create or replace function alert_clusters(
  eps_m double precision default 500,
  min_points int default 1,
  only_open boolean default true
) returns table (
  cluster_id int,
  alert_count bigint,
  centroid_lat double precision,
  centroid_lon double precision,
  max_priority int,
  categories text[],
  msg_ids bigint[]
)
language sql stable
set search_path = public, extensions
as $$
  with raw as (
    select a.msg_id, a.category, a.priority, a.geom,
           ST_ClusterDBSCAN(ST_Transform(a.geom, 3857), eps_m, min_points) over () as cid
    from alerts a
    where a.geom is not null and (not only_open or a.status = 'open')
  ),
  pts as (
    -- DBSCAN noise (null cid, only possible when min_points > 1) becomes its own singleton (negative id)
    select msg_id, category, priority, geom,
           coalesce(cid, -(row_number() over (order by msg_id))::int) as grp
    from raw
  )
  select
    grp as cluster_id,
    count(*) as alert_count,
    ST_Y(ST_Centroid(ST_Collect(geom))) as centroid_lat,
    ST_X(ST_Centroid(ST_Collect(geom))) as centroid_lon,
    max(priority) as max_priority,
    array_agg(distinct category) as categories,
    array_agg(msg_id order by msg_id) as msg_ids
  from pts
  group by grp
$$;

-- 2) Zoom-based grid clustering: marker aggregation that scales with map zoom.
--    Cell size = (Web Mercator metres per pixel at this zoom) * cell_px.
create or replace function map_grid_clusters(
  zoom int,
  cell_px int default 60,
  only_open boolean default true
) returns table (
  alert_count bigint,
  centroid_lat double precision,
  centroid_lon double precision,
  max_priority int,
  msg_ids bigint[]
)
language sql stable
set search_path = public, extensions
as $$
  select
    count(*),
    avg(a.lat), avg(a.lon),
    max(a.priority),
    array_agg(a.msg_id order by a.msg_id)
  from alerts a
  where a.geom is not null and (not only_open or a.status = 'open')
  group by ST_SnapToGrid(ST_Transform(a.geom, 3857), 156543.03392804097 / power(2, zoom) * cell_px)
$$;

grant execute on function alert_clusters(double precision, int, boolean) to anon, authenticated;
grant execute on function map_grid_clusters(int, int, boolean) to anon, authenticated;
