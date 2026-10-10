# Demo Plan, Schedule and Task Sheet

## Demo script (~3 minutes)

Story: low battery in a dead zone, the app warns before stranding, stock and help travel over the mesh, the fleet map shows the whole path.

1. **Setup:** four Android phones. A (rider, battery), B and C (riders, on power banks = charging), Station (power + internet). Laptop shows dashboard. Rider mobile data off, Wi-Fi not connected; Bluetooth and Location on. A and Station out of direct range; B and C between.
2. **Everyday value:** Station sets stock to 4. Within seconds A, offline, shows "Station X: 4 batteries, heard via C, 20 s ago".
3. **Prevention:** A drags battery to 8%. RangeCheck finds no reachable station with stock and raises a low-battery warning: A -> B -> C -> Station. Station taps "battery held".
4. **Emergency:** A taps SOS -> Stranded. Same path; dashboard shows A -> B -> C -> Station with B, C as charging relays.
5. **Proof:** C's relay log: hop 1 via B, zero packets heard directly from A.
6. **Close the loop (stretch):** Station taps "help sent"; ACK travels back and A's screen updates.

If Wi-Fi Direct isn't reliable by the freeze, everything still works on BLE; show a two-phone payload transfer separately.

## Schedule (from 15:00 Saturday; ends ~09:30 Sunday)

1. 15:00-15:45 phone check (BLE advertising, Android >= 10, Wi-Fi Direct dialog); Android Studio project; Supabase tables; dashboard skeleton.
2. 15:45-20:00 **track 1 (mesh):** PacketCodec, scanner, advertiser, Router, MeshService. A -> B by ~17:30; 3-phone relay by 20:00.
3. 15:45-20:00 **track 2 (UI + backend):** Compose screens on fake data, RangeCheck, Edge Functions, fleet map with realtime.
4. 20:00-23:00 connect UI to MeshService; station mode + gateway; stock packets; 4-phone chain end to end.
5. 23:00-01:00 low-battery warning flow; Wi-Fi Direct payload if time allows.
6. 01:00 **feature freeze.**
7. 01:00-04:00 10+ recorded runs of the demo; fix what breaks.
8. 04:00-07:30 slides, pitch, rehearsal; sleep in shifts.
9. 07:30-09:30 buffer, final run.

## Task sheet

Work top-down; finish every P0 before any P1/P2. Hardest: V07, V13, V14.

| ID | Task | Track | Diff. | Priority | Hrs | Depends | Window | Status |
|----|------|-------|-------|----------|-----|---------|--------|--------|
| V01 | Phone check: BLE advertising, Android >= 10, Wi-Fi Direct dialog test | Setup | Easy | P0 | 0.5 | none | 15:00-15:45 | Not started |
| V02 | Android Studio project: Compose, min SDK 29, permissions flow, MeshService skeleton | App | Medium | P0 | 1 | V01 | 15:00-16:00 | Not started |
| V03 | Supabase project, tables, Edge Functions (provision, ingest, sos) | Backend | Medium | P0 | 1.5 | none | 15:00-17:00 | Not started |
| V04 | PacketCodec for SOS, warning, stock, ACK; HMAC; unit tests | Mesh | Easy | P0 | 1 | none | 15:45-17:00 | Not started |
| V05 | BLE scanner + advertiser; first A -> B | Mesh | Medium | P0 | 1.5 | V02, V04 | 16:30-18:00 | Not started |
| V06 | Router + Store: dedup, TTL, hops, energy-aware windows, stock cache | Mesh | Medium | P0 | 2 | V05 | 17:30-19:30 | Not started |
| V07 | 3-phone relay with physical separation; relay log proof | Testing | Hard | P0 | 1 | V06 | 19:00-20:00 | Not started |
| V08 | Compose screens on fake data: home, SOS, nearby, mesh log, station mode | UI | Medium | P0 | 3 | V02 | 15:45-19:00 | Not started |
| V09 | RangeCheck: battery %, range estimate, reachable stations, auto warning | App | Easy | P0 | 1 | V08 | 18:00-20:00 | Not started |
| V10 | Fleet dashboard: Leaflet map, realtime, relay path card, station stock | Web | Medium | P0 | 2 | V03 | 16:00-20:00 | Not started |
| V11 | Wire Compose UI to MeshService StateFlow | App | Medium | P0 | 1 | V06, V08 | 20:00-21:00 | Not started |
| V12 | Station mode: stock broadcast, gateway upload, help sent / battery held | App | Medium | P0 | 1.5 | V03, V11 | 20:00-22:00 | Not started |
| V13 | 4-phone end to end: stock, warning, SOS through A -> B -> C -> Station -> dashboard | Testing | Hard | P0 | 1.5 | V07, V10, V12 | 21:30-23:00 | Not started |
| V14 | Wi-Fi Direct payload: derived-credential group, transfer, re-host | Mesh | Hard | P1 | 2.5 | V13 | 23:00-01:00 | Not started |
| V15 | Offline map tiles cached for demo area | App | Easy | P1 | 0.5 | V08 | any slack | Not started |
| V16 | ACK back to A after help sent | Mesh | Medium | P2 | 1 | V13 | before 01:00 if ahead | Not started |
| V17 | 10+ recorded runs of demo; log success, latency, path | Testing | Easy | P0 | 2 | V13 | 01:00-04:00 | Not started |
| V18 | Slides, pitch, rehearsal | Pitch | Easy | P0 | 3 | V17 | 04:00-07:30 | Not started |
| V19 | Read scooter battery (BMS) over Bluetooth, per manufacturer | Future | Hard | P3 | weeks | V17 | after | Not started |
| V20 | Offline road-hazard sharing from accelerometer bumps | Future | Medium | P3 | days | V17 | after | Not started |

Status legend: BUILD (in scope) · STRETCH (only if all BUILD done) · FUTURE (post-hackathon) · RESEARCH (needs controlled evaluation before any claim).
