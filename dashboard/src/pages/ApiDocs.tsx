import { functionsBase } from "../api";

const ENDPOINTS = [
  ["POST", "/v1/telemetry", "Battery %, temperature, position. Runs RangeCheck; may raise low-battery / thermal alerts."],
  ["POST", "/v1/events", "Vehicle-detected event: crash, stranded, thermal, other."],
  ["GET", "/v1/stations/nearby", "Stations with batteries available (stock minus holds), nearest first."],
  ["POST", "/v1/reservations", "Ask a station to hold a swappable battery."],
  ["GET", "/v1/reservations/:id", "Hold status."],
  ["DELETE", "/v1/reservations/:id", "Cancel a hold."],
];

export function ApiDocs() {
  const base = `${functionsBase}/vehicle`;
  return (
    <>
      <h1>Vehicle API</h1>
      <p>
        Base URL <code>{base}</code>. Authenticate every request with the vehicle's key in the <code>x-api-key</code> header.
        Full spec: <code>docs/api/vehicle-api.yaml</code>.
      </p>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>What it does</th></tr></thead>
        <tbody>
          {ENDPOINTS.map(([m, p, d]) => (
            <tr key={m + p}><td><b>{m}</b></td><td><code>{p}</code></td><td>{d}</td></tr>
          ))}
        </tbody>
      </table>
      <h2>Example</h2>
      <pre>{`curl -X POST ${base}/v1/telemetry \\
  -H "x-api-key: vm_..." -H "Content-Type: application/json" \\
  -d '{"soc_pct": 18, "temp_c": 31.5, "lat": 25.2677, "lon": 82.9913}'`}</pre>
    </>
  );
}
