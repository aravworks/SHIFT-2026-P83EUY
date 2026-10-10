import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import { callFunction } from "../api";
import { useAuth } from "../auth";
import { useFleet } from "../useFleetData";
import type { Vehicle } from "../types";

interface Issued { id: string; api_key: string }

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function Vehicles() {
  const { vehicles, refresh } = useFleet();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [form, setForm] = useState({ label: "", make: "", model: "", fleet: "" });
  const [issued, setIssued] = useState<Issued | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function register(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      setIssued(await callFunction<Issued>("/admin/vehicles", form));
      setForm({ label: "", make: "", model: "", fleet: "" });
      refresh();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function rotate(v: Vehicle) {
    if (!confirm(`Rotate the API key for ${v.label}? The old key stops working immediately.`)) return;
    try {
      setIssued(await callFunction<Issued>(`/admin/vehicles/${v.id}/rotate-key`));
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function saveProfile(v: Vehicle, f: FormData) {
    const { error } = await supabase!.from("vehicles").update({
      km_per_pct: num(String(f.get("km_per_pct"))),
      safety_margin: num(String(f.get("safety_margin"))),
      thermal_limit_c: num(String(f.get("thermal_limit_c"))),
      active: f.get("active") === "on",
    }).eq("id", v.id);
    setErr(error ? error.message : null);
    if (!error) setEditing(null);
    refresh();
  }

  return (
    <>
      <h1>Vehicles</h1>
      <p className="muted">
        Each vehicle gets its own API key (see the Vehicle API page). The profile fields below switch features on per
        scooter; leave a field empty to keep that feature off. No values are assumed.
      </p>
      {err && <p className="error">{err}</p>}

      {issued && (
        <div className="panel key">
          <b>API key (shown once, copy it now)</b>
          <code>{issued.api_key}</code>
          <button onClick={() => navigator.clipboard.writeText(issued.api_key)}>Copy</button>
          <button onClick={() => setIssued(null)}>Done</button>
        </div>
      )}

      {isAdmin && (
        <form onSubmit={register} className="panel row">
          <input placeholder="Label (e.g. Scooter 12)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          <input placeholder="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input placeholder="Fleet" value={form.fleet} onChange={(e) => setForm({ ...form, fleet: e.target.value })} />
          <button>Register vehicle</button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Vehicle</th><th>Fleet</th><th>Battery</th><th>Temp</th><th>Last seen</th><th>Profile</th><th /></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id} className={v.active ? "" : "off"}>
              <td><b>{v.label}</b><br /><small>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</small></td>
              <td>{v.fleet ?? "—"}</td>
              <td>{v.last_soc != null ? `${v.last_soc}%` : "—"}</td>
              <td>{v.last_temp_c != null ? `${v.last_temp_c} °C` : "—"}</td>
              <td>{v.last_seen ? new Date(v.last_seen).toLocaleString() : "never"}</td>
              <td>
                {editing === v.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveProfile(v, new FormData(e.currentTarget)); }} className="profile">
                    <label>km per % <input name="km_per_pct" type="number" step="any" defaultValue={v.km_per_pct ?? ""} /></label>
                    <label>safety margin (0–&lt;1) <input name="safety_margin" type="number" step="any" defaultValue={v.safety_margin ?? ""} /></label>
                    <label>thermal limit °C <input name="thermal_limit_c" type="number" step="any" defaultValue={v.thermal_limit_c ?? ""} /></label>
                    <label><input name="active" type="checkbox" defaultChecked={v.active} /> active</label>
                    <button>Save</button> <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                  </form>
                ) : (
                  <small>
                    range {v.km_per_pct != null && v.safety_margin != null ? "on" : "off"} · thermal {v.thermal_limit_c != null ? `${v.thermal_limit_c} °C` : "off"}
                  </small>
                )}
              </td>
              <td className="actions">
                {isAdmin && editing !== v.id && <button onClick={() => setEditing(v.id)}>Edit</button>}
                {isAdmin && <button onClick={() => rotate(v)}>Rotate key</button>}
              </td>
            </tr>
          ))}
          {vehicles.length === 0 && <tr><td colSpan={7} className="muted">No vehicles registered</td></tr>}
        </tbody>
      </table>
    </>
  );
}
