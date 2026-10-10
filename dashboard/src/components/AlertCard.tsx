import type { Alert, Hop, Station } from "../types";

function seconds(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/** Alert card: category, time, relay path (A -> B -> C -> Station), time to reach backend, status. */
export function AlertCard({ alert, hops, stations }: { alert: Alert; hops: Hop[]; stations: Station[] }) {
  const stationName = new Map(stations.map((s) => [s.node_id, s.name ?? `Station ${s.node_id}`]));
  const path = hops.filter((h) => h.msg_id === alert.msg_id).sort((a, b) => a.hop - b.hop);
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
          <em>{alert.ingress === "direct" ? "Direct upload, no relay hops" : "No hop log uploaded yet"}</em>
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
    </div>
  );
}
