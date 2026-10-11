// Road routing via OSRM. The default is OSRM's public demo server: fine for a hackathon, but it is
// rate-limited, driving-profile only and has no uptime promise. Set VITE_OSRM_URL to self-host.
const BASE = ((import.meta.env.VITE_OSRM_URL as string | undefined) ?? "https://router.project-osrm.org").replace(/\/$/, "");

export interface Route {
  distanceKm: number;
  durationMin: number;
  points: [number, number][]; // [lat, lon]
}

const cache = new Map<string, Promise<Route | null>>();

/** Fastest driving route between two points, or null when OSRM finds none / is unreachable. */
export function fetchRoute(from: [number, number], to: [number, number]): Promise<Route | null> {
  const key = `${from.join(",")}|${to.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = `${BASE}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const r = j?.routes?.[0];
      if (!r) return null;
      return {
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
        points: (r.geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon] as [number, number]),
      };
    })
    .catch(() => null);
  cache.set(key, p);
  // don't cache failures forever
  p.then((r) => {
    if (!r) cache.delete(key);
  });
  return p;
}
