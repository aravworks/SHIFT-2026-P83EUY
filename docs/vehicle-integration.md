# Vehicle Integration

How VoltMesh plugs into an existing scooter. API contract: [`api/vehicle-api.yaml`](api/vehicle-api.yaml).

## What the vehicle side provides

The API is deliberately small and does not care what the scooter is. Anything that can make an HTTPS request with a key can integrate:

| Path | Who runs the client | Notes |
|------|--------------------|-------|
| **A. Telematics / IoT unit** | Scooter's own connected unit or an add-on (cellular) | Direct to the API. Needs connectivity, so it does not help in a dead zone by itself |
| **B. Rider phone as bridge** | The VoltMesh app reads the vehicle (BLE/CAN adapter) and posts to the API, or relays over the mesh when offline | Keeps the offline-first design; BMS reading is V19 and maker-specific |
| **C. Fleet back office** | A fleet's existing system posts telemetry it already collects | Fastest to integrate; no hardware |

Reading a scooter's battery needs a per-maker adapter (CAN, UART or a vendor protocol). That adapter is outside this repo and is the real integration cost; this API is the stable target it posts to. Until then, battery % comes from the rider's slider.

## Features and how the API supports them

| Feature | API |
|---------|-----|
| Energy state of the vehicle | `POST /v1/telemetry` (SoC, voltage, temperature, position) |
| Energy state at charging points | `GET /v1/stations/nearby` returns `available` = stock minus active holds |
| Stranded protection | Telemetry runs RangeCheck: if no station with stock is within usable range, a `low_battery` alert is raised for the portal and stations. The vehicle then calls `POST /v1/reservations` to have the station hold a battery |
| Crash / stranded / overheating | `POST /v1/events` (the vehicle's IMU or BMS decides; the API just records it) |
| Road conditions | Not in v1 (V20, future). Would be a `POST /v1/road-reports` with distinct-reporter confirmation |

## RangeCheck, precisely

`usable_range_km = soc_pct x km_per_pct x (1 - safety_margin)`; haversine distance to each station with `available > 0`; warning when none is within range. It is a heuristic and only as good as the per-vehicle profile. `km_per_pct` and `safety_margin` are set per vehicle in the admin portal and **have no defaults**: if either is empty the check is off for that vehicle (open question: range figure for the demo scooter profile).

The thermal alert fires when `temp_c >= thermal_limit_c` (also per vehicle, no default). This is a threshold on BMS data the vehicle reports, not fire detection; the manual SOS remains the fire alert.

## Battery holds

`POST /v1/reservations` locks the station row and counts stock minus active holds, so the last battery cannot be double-booked. Holds expire after `HOLD_MINUTES` (a server secret that must be set; deliberately has no default), one active hold per vehicle. Station staff mark a hold picked up or cancel it in the portal. A hold is a promise from the system, not proof that a battery is physically set aside: the station still has to act on it.

## Onboarding a vehicle

1. In the admin portal, Vehicles, Register vehicle. Copy the `vm_...` key (shown once).
2. Set the vehicle's profile (km per %, safety margin, optional thermal limit).
3. Configure the device with the base URL and key; send telemetry.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/vehicle/v1/telemetry" \
  -H "x-api-key: $VEHICLE_KEY" -H "Content-Type: application/json" \
  -d '{"soc_pct": 18, "temp_c": 31.5, "lat": 25.2677, "lon": 82.9913}'
```

## Security model and limits

- Per-vehicle keys, stored only as SHA-256; rotate from the portal; deactivating a vehicle blocks its key.
- Admin actions require a user whose `app_metadata.role` is `admin`; portal reads require `admin`, `fleet` or `station`. Give a user a role with:
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '...';`
- Not implemented: rate limiting, replay protection on telemetry timestamps, request signing. A leaked key lets its holder post as that vehicle until rotated.
- Untested against a live project so far (see `backend/README.md`).
