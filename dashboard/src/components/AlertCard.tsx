import type { Alert, Hop, Station } from "../types";
import { useFleet } from "../useFleetData";

function seconds(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/** Alert card: category, time, relay path (A -> B -> C -> Station), time to reach backend, status, help offers. */
export function AlertCard({ alert, hops, stations }: { alert: Alert; hops: Hop[]; stations: Station[] }) {
  const { helpOffers } = useFleet();
  const stationName = new Map(stations.map((s) => [s.node_id, s.name ?? `Station ${s.node_id}`]));
  const path = hops.filter((h) => h.msg_id === alert.msg_id).sort((a, b) => a.hop - b.hop);
  const offers = helpOffers.filter((o) => o.alert_msg_id === alert.msg_id);
  const label = (id: number) => stationName.get(id) ?? `Node ${id}`;

  return (
    <div className="card">
      <h3>
        {alert.category.replace("_", " ")} <span className={`status ${alert.status}`}>{alert.status.replace("_", " ")}</span>
      </h3>
      <p>
        Raised {new Date(alert.created_at).toLocaleTimeString()} · origin Node {alert.origin_node ?? "?"} · via {alert.ingress}
      </p>
      <p>Reached backend after {seconds(alert.created_at, alert.received_at)} s</p>
      <div className="path">
        {path.length === 0 ? (
          <em>{alert.ingress === "direct" ? "Direct upload, no relay hops" : alert.ingress === "vehicle" ? "Reported by the vehicle" : "No hop log uploaded yet"}</em>
        ) : (
          path.map((h, i) => (
            <span key={h.node_id}>
              {i > 0 && " → "}
              <b>{label(h.node_id)}</b>
              <small>
                {" "}
                {h.transport}
                {h.powered ? " ⚡" : ""}
                {h.rssi != null ? ` ${h.rssi} dBm` : ""}
              </small>
            </span>
          ))
        )}
      </div>
      {path.length > 0 && (
        <table className="hops">
          <thead>
            <tr><th>Hop</th><th>Node</th><th>Via</th><th>Radio</th><th>RSSI</th><th>Power</th><th>Tag</th></tr>
          </thead>
          <tbody>
            {path.map((h) => (
              <tr key={h.node_id}>
                <td>{h.hop}</td>
                <td>{label(h.node_id)}</td>
                <td>{h.prev_node != null ? label(h.prev_node) : "—"}</td>
                <td>{h.transport}</td>
                <td>{h.rssi != null ? `${h.rssi} dBm` : "—"}</td>
                <td>{h.powered == null ? "—" : h.powered ? "charging" : "battery"}</td>
                <td>{h.tag_valid == null ? "—" : h.tag_valid ? "✓ valid" : "✗ invalid"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {offers.length > 0 && (
        <div className="offers">
          <b>{offers.length} rider{offers.length > 1 ? "s" : ""} offered help</b>
          <ul>
            {offers.map((o) => (
              <li key={o.id}>
                Node {o.helper_node}
                {o.eta_minutes != null ? ` · ETA ${o.eta_minutes} min` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
