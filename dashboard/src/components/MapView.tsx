import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Alert, GridCluster, Station } from "../types";

const COLORS: Record<Alert["category"], string> = {
  thermal: "#dc2626",
  crash: "#ea580c",
  stranded: "#d97706",
  low_battery: "#2563eb",
  other: "#6b7280",
};

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

const stationIcon = (n: number) =>
  L.divIcon({
    className: "",
    html: `<div class="station-pin">${n}</div>`,
    iconSize: [34, 34],
  });

interface Props {
  alerts: Alert[];
  stations: Station[];
  clusters: GridCluster[];
  selected: number | null;
  onSelect: (msgId: number) => void;
  onZoom: (z: number) => void;
}

export function MapView({ alerts, stations, clusters, selected, onSelect, onZoom }: Props) {
  const byId = new Map(alerts.map((a) => [a.msg_id, a]));
  // Default view: Varanasi (IIT BHU) until a station gives a better centre.
  const center: [number, number] = stations[0] ? [stations[0].lat, stations[0].lon] : [25.2677, 82.9913];

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomWatcher onZoom={onZoom} />
      {stations.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lon]} icon={stationIcon(s.available)}>
          <Popup>
            <b>{s.name ?? `Station ${s.node_id}`}</b>
            <br />
            {s.available} available ({s.batteries_available ?? "?"} in stock, {s.held_count} held)
            {s.stock_updated_at && <> · updated {new Date(s.stock_updated_at).toLocaleTimeString()}</>}
          </Popup>
        </Marker>
      ))}
      {clusters.map((c) => {
        const single = c.alert_count === 1 ? byId.get(c.msg_ids[0]) : undefined;
        const color = single ? COLORS[single.category] : "#7c3aed";
        const isSel = c.msg_ids.some((id) => id === selected);
        return (
          <CircleMarker
            key={c.msg_ids.join(",")}
            center={[c.centroid_lat, c.centroid_lon]}
            radius={single ? 9 : 12 + Math.min(c.alert_count, 20)}
            pathOptions={{ color: isSel ? "#000" : color, fillColor: color, fillOpacity: 0.7, weight: isSel ? 3 : 1 }}
            eventHandlers={{ click: () => onSelect(c.msg_ids[0]) }}
          >
            <Tooltip permanent={!single} direction="center" className="cluster-label">
              {single ? single.category : c.alert_count}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
