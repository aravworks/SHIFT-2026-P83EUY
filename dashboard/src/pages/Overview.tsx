import { useMemo, useState } from "react";
import { useFleet } from "../useFleetData";
import { MapView } from "../components/MapView";
import { AlertCard } from "../components/AlertCard";
import { buildRelayPath } from "../relayPath";
import { useStationRoutes } from "../useStationRoutes";
import { NearbyStations } from "../components/NearbyStations";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function Overview() {
  const { alerts, stations, hops, vehicles, reservations, clusters, setZoom } = useFleet();
  const [selected, setSelected] = useState<number | null>(null);

  const today = alerts.filter((a) => new Date(a.received_at).getTime() >= startOfToday());
  const open = alerts.filter((a) => a.status === "open");
  const sel = alerts.find((a) => a.msg_id === selected);
  const { routes, loading: routing, failed: routeFailed, rangeKm } = useStationRoutes(sel, stations, vehicles);
  const path = useMemo(() => (sel ? buildRelayPath(sel, hops, stations) : null), [sel, hops, stations]);

  return (
    <>
      <h1>Overview</h1>
      <div className="tiles">
        <Tile n={open.length} label="open alerts" />
        <Tile n={today.filter((a) => a.category === "low_battery").length} label="warnings raised today" />
        <Tile n={today.filter((a) => a.ingress === "mesh").length} label="delivered via mesh today" />
        <Tile n={today.filter((a) => a.ingress === "vehicle").length} label="from vehicles today" />
        <Tile n={reservations.filter((r) => r.status === "held" && new Date(r.expires_at) > new Date()).length} label="active battery holds" />
        <Tile n={vehicles.length} label="registered vehicles" />
      </div>
      <div className="split">
        <div className="mapbox">
          <MapView alerts={alerts} stations={stations} clusters={clusters} selected={selected} path={path} routes={routes} onSelect={setSelected} onZoom={setZoom} />
          {sel && <div className="overlay"><AlertCard alert={sel} hops={hops} stations={stations} /></div>}
        </div>
        <div className="panel feed">
          <h3>Open alerts</h3>
          {open.length === 0 && <p className="muted">None</p>}
          {open.map((a) => (
            <button key={a.msg_id} className="feed-row" onClick={() => setSelected(a.msg_id)}>
              <b>{a.category.replace("_", " ")}</b>
              <span>{new Date(a.created_at).toLocaleTimeString()} · {a.ingress}</span>
            </button>
          ))}
          {sel && <NearbyStations routes={routes} loading={routing} failed={routeFailed} rangeKm={rangeKm} />}
        </div>
      </div>
    </>
  );
}

function Tile({ n, label }: { n: number; label: string }) {
  return (
    <div className="tile">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}
