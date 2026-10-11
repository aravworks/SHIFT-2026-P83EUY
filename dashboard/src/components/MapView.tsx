import { useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Alert, GridCluster, Station } from "../types";
import type { RelayPath } from "../relayPath";
import type { StationRoute } from "../useStationRoutes";

const COLORS: Record<Alert["category"], string> = {
  thermal: "#dc2626",
  crash: "#ea580c",
  stranded: "#d97706",
  low_battery: "#2563eb",
  other: "#6b7280",
};

const TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  light: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors" },
} as const;

function savedTheme(): "dark" | "light" {
  try {
    return localStorage.getItem("vm-map-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

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
  path?: RelayPath | null;
  routes?: StationRoute[];
  onSelect: (msgId: number) => void;
  onZoom: (z: number) => void;
}

export function MapView({ alerts, stations, clusters, selected, path, routes, onSelect, onZoom }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">(savedTheme);
  const byId = new Map(alerts.map((a) => [a.msg_id, a]));
  // Default view: Varanasi (IIT BHU) until a station gives a better centre.
  const center: [number, number] = stations[0] ? [stations[0].lat, stations[0].lon] : [25.2677, 82.9913];

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("vm-map-theme", next);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }

  return (
    <>
      <button className="map-theme" onClick={toggle}>{theme === "dark" ? "☀ Light map" : "🌙 Dark map"}</button>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer key={theme} attribution={TILES[theme].attribution} url={TILES[theme].url} />
        <ZoomWatcher onZoom={onZoom} />
        {path && (
          <Polyline positions={path.points} pathOptions={{ color: "#ef4444", weight: 4, opacity: 0.9 }}>
            <Tooltip sticky>
              {path.label}
              <br />
              <small>Schematic: relay phones carry no location, so the line is not the radio path.</small>
            </Tooltip>
          </Polyline>
        )}
        {routes?.map((r, i) => (
          <Polyline
            key={r.station.id}
            positions={r.points}
            pathOptions={{ color: "#22c55e", weight: i === 0 ? 5 : 3, opacity: i === 0 ? 0.95 : 0.6, dashArray: i === 0 ? undefined : "6 8" }}
          >
            <Tooltip sticky>
              {r.station.name ?? `Station ${r.station.node_id}`}: {r.distanceKm.toFixed(1)} km, {Math.round(r.durationMin)} min by road
            </Tooltip>
          </Polyline>
        ))}
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
              pathOptions={{ color: isSel ? "#fff" : color, fillColor: color, fillOpacity: 0.8, weight: isSel ? 3 : 1 }}
              eventHandlers={{ click: () => onSelect(c.msg_ids[0]) }}
            >
              <Tooltip permanent={!single} direction="center" className="cluster-label">
                {single ? single.category : c.alert_count}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </>
  );
}
