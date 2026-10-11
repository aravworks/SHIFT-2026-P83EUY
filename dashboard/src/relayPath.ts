import type { Alert, Hop, Station } from "./types";

export interface RelayPath {
  points: [number, number][];
  label: string;
}

/**
 * Schematic relay path for the map. Only two kinds of positions are known: where the alert was raised and
 * where stations are. Phone relays carry no location by design (privacy), so they appear in the label but the
 * line runs origin -> (any station hops) -> receiving station, not along the true radio path.
 */
export function buildRelayPath(alert: Alert, hops: Hop[], stations: Station[]): RelayPath | null {
  const byNode = new Map(stations.map((s) => [s.node_id, s]));
  const chain = hops.filter((h) => h.msg_id === alert.msg_id).sort((a, b) => a.hop - b.hop);

  const points: [number, number][] = [[alert.lat, alert.lon]];
  const names: string[] = [`Node ${alert.origin_node ?? "?"}`];

  for (const h of chain) {
    const st = byNode.get(h.node_id);
    names.push(st ? (st.name ?? `Station ${st.node_id}`) : `Node ${h.node_id}`);
    if (st) points.push([st.lat, st.lon]);
  }
  const gw = alert.gateway_node != null ? byNode.get(alert.gateway_node) : undefined;
  if (gw) {
    const last = points[points.length - 1];
    if (last[0] !== gw.lat || last[1] !== gw.lon) {
      points.push([gw.lat, gw.lon]);
      if (!chain.some((h) => h.node_id === gw.node_id)) names.push(gw.name ?? `Station ${gw.node_id}`);
    }
  }
  return points.length >= 2 ? { points, label: names.join(" → ") } : null;
}
