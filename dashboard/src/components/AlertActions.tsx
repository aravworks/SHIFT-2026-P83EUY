import { useMemo, useState } from "react";
import { callFunction } from "../api";
import { haversineKm } from "../geo";
import { useFleet } from "../useFleetData";
import type { Alert } from "../types";

/** "Battery held": ask a station to hold a swappable battery for this alert (station staff / fleet / admin). */
export function AlertActions({ alert }: { alert: Alert }) {
  const { stations, reservations, refresh } = useFleet();
  const [stationId, setStationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const active = reservations.find((r) => r.alert_msg_id === alert.msg_id && r.status === "held" && new Date(r.expires_at) > new Date());
  const heldAt = active ? stations.find((s) => s.id === active.station_id) : undefined;

  const options = useMemo(
    () =>
      stations
        .filter((s) => s.available > 0)
        .map((s) => ({ s, km: haversineKm(alert.lat, alert.lon, s.lat, s.lon) }))
        .sort((a, b) => a.km - b.km),
    [stations, alert.lat, alert.lon],
  );
  const chosen = stationId || options[0]?.s.id || "";

  async function hold() {
    setBusy(true);
    setErr(null);
    try {
      await callFunction(`/admin/alerts/${alert.msg_id}/hold`, { station_id: chosen });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  if (active) {
    return (
      <div className="card hold">
        <b>Battery held</b> at {heldAt?.name ?? "station"} until {new Date(active.expires_at).toLocaleTimeString()}.
        <p className="muted">A hold is a promise from the system; the station still has to set a battery aside.</p>
      </div>
    );
  }
  if (alert.status === "resolved") return null;

  return (
    <div className="card hold">
      <b>Hold a battery</b>
      {options.length === 0 ? (
        <p className="muted">No station has a battery available.</p>
      ) : (
        <div className="row-inline">
          <select value={chosen} onChange={(e) => setStationId(e.target.value)}>
            {options.map(({ s, km }) => (
              <option key={s.id} value={s.id}>
                {s.name ?? `Station ${s.node_id}`} · {s.available} available · {km.toFixed(1)} km
              </option>
            ))}
          </select>
          <button onClick={hold} disabled={busy}>{busy ? "Holding…" : "Battery held"}</button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
