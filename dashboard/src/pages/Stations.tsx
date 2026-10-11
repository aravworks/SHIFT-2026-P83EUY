import { useState } from "react";
import { supabase } from "../supabase";
import { callFunction } from "../api";
import { useFleet } from "../useFleetData";
import type { Reservation } from "../types";

export function Stations() {
  const { stations, reservations, vehicles, refresh } = useFleet();
  const stationName = (id: string) => stations.find((s) => s.id === id);
  const vehicleLabel = (id: string | null) => vehicles.find((v) => v.id === id)?.label ?? "—";

  const [err, setErr] = useState<string | null>(null);

  async function adjust(stationId: string, body: { delta?: number; set?: number }) {
    setErr(null);
    try {
      await callFunction(`/admin/stations/${stationId}/stock`, body);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function close(r: Reservation, status: "picked_up" | "cancelled") {
    await supabase!.from("reservations").update({ status }).eq("id", r.id);
    refresh();
  }

  return (
    <>
      <h1>Stations</h1>
      {err && <p className="error">{err}</p>}
      <table>
        <thead>
          <tr><th>Station</th><th>Node</th><th>In stock</th><th /><th>Held</th><th>Available</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id}>
              <td>{s.name ?? "—"}</td>
              <td>{s.node_id}</td>
              <td>{s.batteries_available ?? "?"}</td>
              <td className="actions">
                <button onClick={() => adjust(s.id, { delta: -1 })} disabled={(s.batteries_available ?? 0) <= s.held_count}>−</button>
                <button onClick={() => adjust(s.id, { delta: 1 })}>+</button>
              </td>
              <td>{s.held_count}</td>
              <td><b>{s.available}</b></td>
              <td>{s.stock_updated_at ? new Date(s.stock_updated_at).toLocaleTimeString() : "never"}</td>
            </tr>
          ))}
          {stations.length === 0 && <tr><td colSpan={7} className="muted">No stations provisioned</td></tr>}
        </tbody>
      </table>

      <h2>Battery holds</h2>
      <table>
        <thead>
          <tr><th>Created</th><th>Station</th><th>Vehicle</th><th>Expires</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleTimeString()}</td>
              <td>{stationName(r.station_id)?.name ?? r.station_id.slice(0, 8)}</td>
              <td>{vehicleLabel(r.vehicle_id)}</td>
              <td>{new Date(r.expires_at).toLocaleTimeString()}</td>
              <td>{r.status.replace("_", " ")}</td>
              <td className="actions">
                {r.status === "held" && (
                  <>
                    <button onClick={() => close(r, "picked_up")}>Picked up</button>
                    <button onClick={() => close(r, "cancelled")}>Cancel</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {reservations.length === 0 && <tr><td colSpan={6} className="muted">No holds yet</td></tr>}
        </tbody>
      </table>
    </>
  );
}
