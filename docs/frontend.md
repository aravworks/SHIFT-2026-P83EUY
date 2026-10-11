# Frontend Design

Three surfaces: the rider app, the station mode of the same app, and the **admin portal** (`dashboard/`). The app is framework-neutral here (currently React Native/Expo with native BLE/Wi-Fi Direct modules, see `architecture.md`).

Shared rule: show "last heard X min ago" instead of pretending data is live, and show nothing that is not measured.

## Rider mode

| Screen | Contents |
|--------|----------|
| **Home** | Battery % slider (rider-entered; BMS reading is FUTURE), estimated range (heuristic, labelled), nearby stations with stock and "last heard X min ago", large SOS button |
| **SOS** | One tap sends *Stranded*; alternatives: Crash, Battery overheating/fire, Other |
| **Nearby alerts** | Others' alerts with distance and hop count; "I can help" |
| **Mesh** (demo proof) | Peers, charging peers, station in reach, alerts carried, relay log |
| **Low-battery banner** | Raised by RangeCheck when no reachable station has stock; cancellable |

## Station mode

Stock (+/-), Incoming (warnings and SOS; "help sent", "battery held"), Gateway status.

## Admin portal (`dashboard/`)

React + Vite + Leaflet + React Router (hash routes), Supabase Auth login. Role comes from the JWT (`app_metadata.role`); data is protected by row-level security, not just hidden in the UI.

| Page | Roles | Contents |
|------|-------|----------|
| **Login** | all | Email and password (Supabase Auth). Accounts without a role are told to ask an admin |
| **Overview** | admin, fleet, station | Tiles (open alerts, warnings today, delivered via mesh today, from vehicles today, active holds, vehicles); clustered live map; open-alert feed; alert card with relay path |
| **Alerts** | all | Filterable table (status, category); alert card; "Help sent" / "Resolve" (writes only `alerts.status`) |
| **Stations** | all | Stock, held, available per station; battery holds with "Picked up" / "Cancel" |
| **Vehicles** | admin, fleet (edit: admin) | Registered vehicles with last battery, temperature and last-seen; register a vehicle (API key shown once), rotate key, edit per-vehicle profile (km per %, safety margin, thermal limit; empty = feature off), deactivate |
| **Vehicle API** | admin, fleet | Endpoints, base URL, curl example; links to `docs/api/vehicle-api.yaml` |

Map: station pins show *available* batteries (stock minus holds); open alerts are colour-coded and aggregated per zoom level server-side (`database-clustering.md`).

Realtime: alerts, relay hops, stations and reservations push changes; vehicles are polled every 15 s (column-level grants keep the key hash unreadable, which rules out Realtime on that table).

Not on the portal: rider positions (the protocol carries no rider identity or standing location).

## Run

```bash
cd dashboard
cp .env.example .env   # Supabase URL + anon key
npm install
npm run dev
```

## Road routing to stations (OSRM)

Selecting an alert on the Overview map draws road routes to the nearest three stations that have batteries available (green line, best route thicker) and lists distance and time. If the alert came from a vehicle with a profile and a known battery %, each route is marked within or beyond the usable range, using road distance rather than straight-line distance. Routing uses OSRM's public demo server by default (rate-limited, driving profile only, no uptime promise); set `VITE_OSRM_URL` to self-host. Times assume car speeds, not a scooter's.

## Devices page (Web Bluetooth)

`/devices` scans through the browser's own device chooser, connects, and reads the standard Battery and Device Information characteristics. A second panel reads or writes one GATT characteristic you name (for commands and readings), and a Share panel opens the system share sheet.

What a browser can and cannot do:
- Chrome and Edge only (desktop and Android), over HTTPS or localhost, each scan started by a click. Firefox and Safari have no Web Bluetooth.
- The page cannot list nearby or connected devices by itself; the user picks in the chooser. Only Bluetooth Low Energy devices appear. Ordinary Bluetooth audio links (most headphone music connections) are not reachable.
- Services must be declared before scanning (the "extra service UUIDs" field); anything else is blocked.
- A BLE write carries at most a few hundred bytes. Files cannot go over Bluetooth from a web page. ShareIt used Wi-Fi, not Bluetooth; the Share panel hands files to the system share sheet (Quick Share, Nearby Share and so on).
- This is also the starting point for reading a scooter's battery over BLE (task V19), if the scooter exposes a standard battery service. Not tested against any real device so far.
