import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type { Alert, GridCluster, Hop, Reservation, Station, Vehicle } from "./types";

interface FleetData {
  alerts: Alert[];
  stations: Station[];
  hops: Hop[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  clusters: GridCluster[];
  error: string | null;
  zoom: number;
  setZoom: (z: number) => void;
  refresh: () => void;
}

const Ctx = createContext<FleetData>(null!);
export const useFleet = () => useContext(Ctx);

const VEHICLE_COLS =
  "id,label,make,model,fleet,active,km_per_pct,safety_margin,thermal_limit_c,last_soc,last_temp_c,last_lat,last_lon,last_seen,created_at";

/** Loads everything the portal shows and re-fetches on Realtime changes (RLS applies to the signed-in user). */
export function FleetProvider({ children }: { children: ReactNode }) {
  const { session, role } = useAuth();
  const [zoom, setZoom] = useState(13);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [hops, setHops] = useState<Hop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clusters, setClusters] = useState<GridCluster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSeeVehicles = role === "admin" || role === "fleet";

  const load = useCallback(async () => {
    if (!supabase || !session || !role) return;
    const [a, s, h, r, c, v] = await Promise.all([
      supabase.from("alerts").select("*").order("received_at", { ascending: false }).limit(500),
      supabase.from("station_availability").select("*"),
      supabase.from("relay_hops").select("*").order("hop"),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.rpc("map_grid_clusters", { zoom: Math.round(zoom), cell_px: 60, only_open: true }),
      canSeeVehicles
        ? supabase.from("vehicles").select(VEHICLE_COLS).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const err = a.error ?? s.error ?? h.error ?? r.error ?? c.error ?? v.error;
    setError(err ? err.message : null);
    setAlerts((a.data as Alert[]) ?? []);
    setStations((s.data as Station[]) ?? []);
    setHops((h.data as Hop[]) ?? []);
    setReservations((r.data as Reservation[]) ?? []);
    setClusters((c.data as GridCluster[]) ?? []);
    setVehicles((v.data as unknown as Vehicle[]) ?? []);
  }, [zoom, session, role, canSeeVehicles]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !session || !role) return;
    const ch = supabase
      .channel("fleet")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "relay_hops" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "stations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    // vehicles/telemetry are not on Realtime (column-level grants): poll.
    const t = setInterval(load, 15000);
    return () => {
      clearInterval(t);
      supabase!.removeChannel(ch);
    };
  }, [load, session, role]);

  return (
    <Ctx.Provider value={{ alerts, stations, hops, vehicles, reservations, clusters, error, zoom, setZoom, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}
