import type { StationRoute } from "../useStationRoutes";

/** Nearest stations with stock, by road (OSRM), with a range check when the vehicle's battery is known. */
export function NearbyStations({ routes, loading, failed, rangeKm }: { routes: StationRoute[]; loading: boolean; failed: boolean; rangeKm: number | null }) {
  return (
    <div className="nearby">
      <h3>Nearest stations by road</h3>
      {rangeKm != null && <p className="muted">Usable range {rangeKm.toFixed(1)} km (heuristic)</p>}
      {loading && <p className="muted">Routing…</p>}
      {failed && <p className="error">Routing service unreachable (OSRM).</p>}
      {!loading && !failed && routes.length === 0 && <p className="muted">No station with a battery available.</p>}
      {routes.map((r, i) => (
        <div key={r.station.id} className={`route-row ${i === 0 ? "best" : ""}`}>
          <b>{r.station.name ?? `Station ${r.station.node_id}`}</b>
          <span>
            {r.distanceKm.toFixed(1)} km · {Math.round(r.durationMin)} min · {r.station.available} available
            {r.inRange === true && " · within range"}
            {r.inRange === false && " · beyond range"}
          </span>
        </div>
      ))}
      <p className="muted">Road distance and time come from OSRM; they assume driving speeds, not a scooter's.</p>
    </div>
  );
}
