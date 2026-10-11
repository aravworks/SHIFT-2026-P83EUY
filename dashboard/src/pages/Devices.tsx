import { useEffect, useRef, useState } from "react";
import {
  connect, type DeviceInfo, parsePayload, pickDevice, previouslyGranted, readCharacteristic, readInfo,
  supportsBluetooth, supportsShare, toHex, writeCharacteristic,
} from "../bluetooth";

interface Entry {
  device: BluetoothDevice;
  connected: boolean;
  info?: DeviceInfo;
  busy?: boolean;
  error?: string;
}

export function Devices() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const watched = useRef(new Set<string>());

  const patch = (id: string, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.device.id === id ? { ...e, ...p } : e)));
  const addLog = (l: string) => setLog((x) => [`${new Date().toLocaleTimeString()}  ${l}`, ...x].slice(0, 30));

  function track(device: BluetoothDevice) {
    if (watched.current.has(device.id)) return;
    watched.current.add(device.id);
    device.addEventListener("gattserverdisconnected", () => patch(device.id, { connected: false }));
  }

  useEffect(() => {
    if (!supportsBluetooth) return;
    previouslyGranted().then((ds) => {
      ds.forEach(track);
      setEntries((es) => [...es, ...ds.filter((d) => !es.some((e) => e.device.id === d.id)).map((d) => ({ device: d, connected: !!d.gatt?.connected }))]);
    });
  }, []);

  async function scan() {
    setMsg(null);
    try {
      const device = await pickDevice(extra.split(",").filter((s) => s.trim()));
      track(device);
      setEntries((es) => (es.some((e) => e.device.id === device.id) ? es : [{ device, connected: false }, ...es]));
      addLog(`Selected ${device.name ?? device.id}`);
    } catch (e) {
      const err = e as Error;
      // NotFoundError = the user closed the chooser; not worth an error banner
      if (err.name !== "NotFoundError") setMsg(err.message);
    }
  }

  async function toggle(e: Entry) {
    patch(e.device.id, { busy: true, error: undefined });
    try {
      if (e.connected) {
        e.device.gatt?.disconnect();
        patch(e.device.id, { connected: false, busy: false });
        addLog(`Disconnected ${e.device.name ?? e.device.id}`);
      } else {
        await connect(e.device);
        const info = await readInfo(e.device);
        patch(e.device.id, { connected: true, info, busy: false });
        addLog(`Connected ${e.device.name ?? e.device.id}`);
      }
    } catch (x) {
      patch(e.device.id, { busy: false, error: (x as Error).message });
    }
  }

  return (
    <>
      <h1>Devices</h1>
      {!supportsBluetooth && (
        <div className="banner">
          This browser has no Web Bluetooth. Use Chrome or Edge (desktop or Android) over HTTPS. Firefox and Safari do not support it.
        </div>
      )}
      <p className="muted">
        A web page cannot list nearby or connected devices by itself: you pick devices in the browser's chooser. Only Bluetooth Low Energy
        devices appear; ordinary Bluetooth audio (most headphone music links) is not reachable from a browser.
      </p>

      <div className="panel row">
        <input
          placeholder="Extra service UUIDs to allow (optional, comma-separated)"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button onClick={scan} disabled={!supportsBluetooth}>Scan for devices</button>
      </div>
      <p className="muted">Services you want to read or write later must be listed above before you scan; the browser blocks anything not declared.</p>
      {msg && <p className="error">{msg}</p>}

      <table>
        <thead>
          <tr><th>Device</th><th>Status</th><th>Info</th><th /></tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.device.id}>
              <td><b>{e.device.name ?? "Unnamed device"}</b><br /><small>{e.device.id.slice(0, 12)}…</small></td>
              <td>{e.connected ? "connected" : "not connected"}{e.error && <div className="error">{e.error}</div>}</td>
              <td>
                {e.info ? (
                  <small>
                    {e.info.batteryPct != null && <>battery {e.info.batteryPct}%<br /></>}
                    {e.info.manufacturer && <>{e.info.manufacturer}<br /></>}
                    {e.info.model && <>model {e.info.model}<br /></>}
                    {e.info.firmware && <>fw {e.info.firmware}</>}
                    {Object.values(e.info).every((v) => v === undefined) && "No standard info exposed"}
                  </small>
                ) : "—"}
              </td>
              <td className="actions"><button onClick={() => toggle(e)} disabled={e.busy}>{e.busy ? "…" : e.connected ? "Disconnect" : "Connect & read"}</button></td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={4} className="muted">No devices yet. Click "Scan for devices".</td></tr>}
        </tbody>
      </table>

      <Transfer entries={entries} addLog={addLog} />
      <Share />

      {log.length > 0 && <pre className="btlog">{log.join("\n")}</pre>}
    </>
  );
}

/** Generic read/write of one GATT characteristic on a connected device. */
function Transfer({ entries, addLog }: { entries: Entry[]; addLog: (l: string) => void }) {
  const connected = entries.filter((e) => e.connected);
  const [id, setId] = useState("");
  const [svc, setSvc] = useState("");
  const [chr, setChr] = useState("");
  const [mode, setMode] = useState<"text" | "hex">("text");
  const [payload, setPayload] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const target = connected.find((e) => e.device.id === (id || connected[0]?.device.id));

  async function run(kind: "read" | "write") {
    setErr(null);
    if (!target) return;
    try {
      if (kind === "read") {
        const v = await readCharacteristic(target.device, svc, chr);
        addLog(`READ ${chr}: ${toHex(v)}`);
      } else {
        const data = parsePayload(payload, mode);
        await writeCharacteristic(target.device, svc, chr, data);
        addLog(`WROTE ${data.length} byte(s) to ${chr}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <h2>Pull or push data (one characteristic)</h2>
      <div className="panel">
        {connected.length === 0 ? (
          <p className="muted">Connect a device above first.</p>
        ) : (
          <div className="row-inline">
            <select value={target?.device.id} onChange={(e) => setId(e.target.value)}>
              {connected.map((e) => <option key={e.device.id} value={e.device.id}>{e.device.name ?? e.device.id.slice(0, 8)}</option>)}
            </select>
            <input placeholder="Service UUID (e.g. 180f)" value={svc} onChange={(e) => setSvc(e.target.value)} />
            <input placeholder="Characteristic UUID (e.g. 2a19)" value={chr} onChange={(e) => setChr(e.target.value)} />
            <select value={mode} onChange={(e) => setMode(e.target.value as "text" | "hex")}>
              <option value="text">text</option>
              <option value="hex">hex</option>
            </select>
            <input placeholder="Payload to write" value={payload} onChange={(e) => setPayload(e.target.value)} />
            <button onClick={() => run("read")}>Pull (read)</button>
            <button onClick={() => run("write")}>Push (write)</button>
          </div>
        )}
        {err && <p className="error">{err}</p>}
        <p className="muted">Only write to devices you own. A BLE write carries at most a few hundred bytes, so this is for commands and readings, not files.</p>
      </div>
    </>
  );
}

/** ShareIt-style sharing: hands files to the system share sheet (Quick Share / Nearby Share etc.). */
function Share() {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    setMsg(null);
    try {
      const data: ShareData = { title: "VoltMesh", text: note || undefined };
      if (files.length) {
        if (!navigator.canShare?.({ files })) throw new Error("This browser cannot share these file types");
        data.files = files;
      }
      await navigator.share(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg((e as Error).message);
    }
  }

  return (
    <>
      <h2>Share files</h2>
      <div className="panel">
        {!supportsShare && <p className="muted">This browser has no share sheet (mobile Chrome/Edge and Safari have one).</p>}
        <div className="row-inline">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={share} disabled={!supportsShare || (!files.length && !note)}>Share…</button>
        </div>
        {msg && <p className="error">{msg}</p>}
        <p className="muted">
          This opens your device's share sheet; what appears there (Quick Share, Nearby Share, Bluetooth, and so on) is decided by your phone or
          computer. A web page cannot send files over Bluetooth by itself.
        </p>
      </div>
    </>
  );
}
