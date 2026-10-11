import { useEffect, useMemo, useState } from "react";
import { haversineKm } from "./geo";
import { fetchRoute } from "./osrm";
import type { Alert, Station, Vehicle } from "./types";

export interface StationRoute {
  station: Station;
  distanceKm: number;
  durationMin: number;
  points: [number, number][];
  /** Road distance within the vehicle's usable range; null when range is unknown (no vehicle/profile/battery). */
  inRange: boolean | null;
}

const NEAREST = 3;

/** Road routes from an alert to the nearest stations that have batteries available. */
export function useStationRoutes(alert: Alert | undefined, stations: Station[], vehicles: Vehicle[]) {
  const [routes, setRoutes] = useState<StationRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Usable range = battery % x km per % x (1 - safety margin); the same heuristic the backend uses.
  const rangeKm = useMemo(() => {
    const v = vehicles.find((x) => x.id === alert?.vehicle_id);
    return v && v.last_soc != null && v.km_per_pct != null && v.safety_margin != null
      ? v.last_soc * v.km_per_pct * (1 - v.safety_margin)
      : null;
  }, [alert?.vehicle_id, vehicles]);

  const candidates = useMemo(() => {
    if (!alert) return [];
    return stations
      .filter((s) => s.available > 0)
      .map((s) => ({ s, km: haversineKm(alert.lat, alert.lon, s.lat, s.lon) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, NEAREST)
      .map((x) => x.s);
  }, [alert, stations]);

  const key = candidates.map((s) => s.id).join(",");

  useEffect(() => {
    let cancelled = false;
    if (!alert || candidates.length === 0) {
      setRoutes([]);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    Promise.all(candidates.map((s) => fetchRoute([alert.lat, alert.lon], [s.lat, s.lon]).then((r) => ({ s, r })))).then((res) => {
      if (cancelled) return;
      const ok = res.filter((x) => x.r);
      setFailed(ok.length === 0);
      setRoutes(
        ok
          .map(({ s, r }) => ({
            station: s,
            distanceKm: r!.distanceKm,
            durationMin: r!.durationMin,
            points: r!.points,
            inRange: rangeKm == null ? null : r!.distanceKm <= rangeKm,
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.msg_id, key, rangeKm]);

  return { routes, loading, failed, rangeKm };
}
