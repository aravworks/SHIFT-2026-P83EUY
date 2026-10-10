import { useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { useFleet } from "../useFleetData";
import { AlertCard } from "../components/AlertCard";
import type { Alert } from "../types";

export function Alerts() {
  const { alerts, stations, hops, vehicles, refresh } = useFleet();
  const { role } = useAuth();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = alerts.filter((a) => (!status || a.status === status) && (!category || a.category === category));
  const sel = alerts.find((a) => a.msg_id === selected);
  const vehicleLabel = (id: string | null) => vehicles.find((v) => v.id === id)?.label;

  async function setAlertStatus(a: Alert, next: Alert["status"]) {
    const { error } = await supabase!.from("alerts").update({ status: next }).eq("msg_id", a.msg_id);
    setErr(error ? error.message : null);
    refresh();
  }

  return (
    <>
      <h1>Alerts</h1>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="help_sent">Help sent</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {["low_battery", "stranded", "thermal", "crash", "other"].map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <span className="muted">{rows.length} shown</span>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="split">
        <table>
          <thead>
            <tr><th>Time</th><th>Category</th><th>Source</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.msg_id} className={a.msg_id === selected ? "sel" : ""} onClick={() => setSelected(a.msg_id)}>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>{a.category.replace("_", " ")}</td>
                <td>{a.ingress}{vehicleLabel(a.vehicle_id) ? ` · ${vehicleLabel(a.vehicle_id)}` : a.origin_node ? ` · node ${a.origin_node}` : ""}</td>
                <td><span className={`status ${a.status}`}>{a.status.replace("_", " ")}</span></td>
                <td className="actions">
                  {role && a.status === "open" && <button onClick={(e) => { e.stopPropagation(); setAlertStatus(a, "help_sent"); }}>Help sent</button>}
                  {role && a.status !== "resolved" && <button onClick={(e) => { e.stopPropagation(); setAlertStatus(a, "resolved"); }}>Resolve</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No alerts</td></tr>}
          </tbody>
        </table>
        <div>{sel && <AlertCard alert={sel} hops={hops} stations={stations} />}</div>
      </div>
      <p className="muted">An alert reaching the system is not help arriving: status changes come from people.</p>
    </>
  );
}
