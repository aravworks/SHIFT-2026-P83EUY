# Database Clustering

"Clustering" here means **spatial clustering of alerts inside Postgres** so the fleet map stays readable and fast. It is not database server clustering or replication; a hackathon-scale Supabase project does not need that.

Migration: `backend/supabase/migrations/0002_spatial_clustering.sql` (PostGIS).

## Schema additions

- `alerts.geom` and `stations.geom`: `geometry(Point, 4326)`, generated from `lat`/`lon`, so they can never drift from the source columns.
- GiST indexes on both.

## Two clustering functions

| Function | Method | Use |
|----------|--------|-----|
| `map_grid_clusters(zoom, cell_px=60, only_open=true)` | Snap-to-grid in Web Mercator. Cell size = (156543.034 m/px / 2^zoom) x `cell_px`, so clusters re-form as the user zooms | The dashboard map (what `useFleetData` calls) |
| `alert_clusters(eps_m=500, min_points=1, only_open=true)` | `ST_ClusterDBSCAN` density clustering | Grouping alerts into incident areas (e.g. several SOS near one flyover). With `min_points=1` nothing is discarded as noise; with higher values noise points come back as singletons |

Both return counts, centroid, max priority and the member `msg_id`s, so the client can drill into a cluster.

## Caveats

- Distances are in EPSG:3857, which stretches by roughly 1/cos(latitude) (about 1.4x near 45 degrees; less at Varanasi's ~25 degrees). Fine for map aggregation, not for precise distance claims. Use `geography` if exact metres are ever needed.
- BLE alert coordinates are quantised to 1e-4 degrees (~11 m), so clusters finer than that are meaningless.
- Functions are `security invoker`, so row-level security still applies; the demo policies allow anonymous read (disclosed in `backend/README.md`).
- Untested against a live database so far; run `supabase db reset` and call both functions on a few inserted rows before relying on them.

## Possible next steps (not built)

- Cluster-level status roll-up (any open thermal alert turns the cluster red).
- Station coverage zones: cluster stranded alerts and report the nearest station per cluster.
- Time-windowed clustering for the recorded demo runs (V17).
