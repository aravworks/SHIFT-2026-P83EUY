# Mesh Protocol

BLE advertisements carry discovery and a 24-byte alert between phones with no connection. Wi-Fi Direct moves the larger incident payload. Routing prefers powered phones and stations. All of this lives in `MeshService`.

## Two radios, two jobs

| | BLE | Wi-Fi Direct |
|-|-----|--------------|
| Carries | Beacon (presence, flags) + compact alert | Full incident: location trail, sensor snapshot, notes, signature |
| Setup | None; advertise and scan | Group + TCP socket, ~2-10 s |
| Size | ~24 bytes | Megabytes |
| If it fails | n/a | Alert still travelled over BLE |

Wi-Fi Direct credentials are derived, never broadcast: SSID `DIRECT-VM-<msgId hex>`, passphrase = `HMAC(groupKey, msgId)` truncated to 16 chars.

## Beacon flags (idle phones)

`powered` (charging) · `isStation` · `hasInternet` · `wifiDirectCapable` · protocol version · rotating anonymous node ID. No names, no locations.

## Alert packet (24 bytes, manufacturer data, company ID 0xFFFF)

| Bytes | Field | Notes |
|-------|-------|-------|
| 0 | version (3 bits) · bulkAvailable (1) · type (4) | type: beacon, SOS, low-battery warning, station stock, ACK |
| 1-4 | msgId | random; dedup key |
| 5-6 | originId | anonymous node ID |
| 7 | hop (4 bits) · maxHop (4) | maxHop 4 |
| 8-9 | prevHopId | proves who relayed |
| 10-13 | createdAt | epoch seconds |
| 14-16 | lat x 1e4 | ~11 m |
| 17-19 | lon x 1e4 | |
| 20 | category (4 bits) · priority (4) | stranded, thermal, crash, manual |
| 21-23 | HMAC tag (3 bytes) | over immutable fields; demo-grade |

## Station stock packet (everyday traffic)

Same 24-byte frame, `type = stock`. Stations broadcast continuously; riders relay with the same dedup/hop rules and cache the newest version per station.

| Bytes | Field | Notes |
|-------|-------|-------|
| 0 | version · 0 · type | type = stock |
| 1-4 | stockVersion | increments on every change; newer replaces older |
| 5-6 | stationNodeId | maps to station on backend |
| 7 | hop · maxHop | maxHop 3 |
| 8-9 | prevHopId | |
| 10-13 | updatedAt | riders show "last heard X min ago" |
| 14-19 | station lat, lon (x1e4) | public, plaintext |
| 20 | batteriesAvailable | 0-255 |
| 21-23 | HMAC tag | stops fake "batteries available" |

## Low-battery warning

SOS-format packet with `type = warning`, rider battery % in the priority nibble (10% steps). Raised automatically by `RangeCheck` when no station with stock is reachable; rider can cancel. Routed like SOS, lower priority.

## Routing rules

1. Verify tag; drop if expired (TTL 10 min) or already seen. Log every receipt.
2. If new and `hop < maxHop`: store, `hop + 1`, `prevHop = me`, rebroadcast.
3. Energy-aware: powered phones/stations rebroadcast and host for the full window (~60 s, then on each new peer); battery-only phones rebroadcast ~15 s and host only their own SOS payload.
4. If bulk flag set and this phone is powered, pull payload over Wi-Fi Direct, then host it.
5. If `hasInternet` or `isStation`: upload to backend; flood an ACK so others stop rebroadcasting.

## Android gotchas

- One long-running filtered scan; Android silently blocks >5 scan starts in 30 s.
- Permissions: Bluetooth scan/advertise/connect, nearby Wi-Fi devices, location on older versions; Location toggle ON.
- Wi-Fi radio ON but not connected; call `removeGroup()` before every new group.
- Check `bluetoothLeAdvertiser != null` on startup; Android 10+ for the Wi-Fi Direct config builder.
