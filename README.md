# VoltMesh: Offline Safety Network for E-Micromobility

> Working name. Built at the **SHIFT hackathon, IIT BHU (10-11 Oct 2026)**, sustainable e-micromobility theme.

VoltMesh is a native Android app (plus a small web dashboard for fleets) that keeps electric two-wheeler riders connected to **batteries** and to **help** when there is no network. Riders' phones and battery-swap stations form an offline mesh.

**Pitch:** riders use VoltMesh every shift to find charged batteries offline, and that same always-on network of phones and swap stations carries SOS alerts when something goes wrong.

## Why

EV riders (especially delivery riders) fail in ways petrol riders don't, often where coverage is weakest: depleted battery far from a station, battery thermal events, crashes, dead zones, prepaid data running out. Fear of being stranded slows the switch from petrol. A safety net that needs no towers removes that barrier.

An SOS-only mesh has a cold-start problem (nobody keeps an app open for a rare emergency). So **everyday battery-stock availability comes first**; every rider who keeps the app on for batteries is also a relay for someone else's SOS.

## The three layers (all BUILD)

| # | Layer | What it does |
|---|-------|--------------|
| 1 | Offline battery availability | Stations broadcast batteries in stock; rider phones relay and cache it |
| 2 | Stranding prevention | Rider sets battery %; if no reachable station has stock, a low-battery warning is raised early |
| 3 | SOS relay | Stranded / crash / battery fire (manual) / other, hopping rider -> rider -> station |

## Design decisions (fixed)

- **BLE** carries discovery and compact (24-byte) data; **Wi-Fi Direct** carries larger payloads. No other transport.
- Rider and station devices: **React Native/Expo + custom Native Modules**, min SDK 29. Mesh code lives in a foreground `MeshService` natively; bridged to JS for the UI.
- Fleet dashboard: **React + Vite + Leaflet + Supabase realtime** (read-only).
- Backend: **new Supabase project** (Postgres, Edge Functions, Realtime, Storage).
- Android only (iPhones can't do background BLE + Wi-Fi Direct relaying).
- Fully separate from Sentinel: no shared code, data, keys or branding.

## What VoltMesh does not claim

- It does not read scooter battery automatically; battery % is entered by the rider (BMS reading is FUTURE).
- It does not detect battery fires; that alert is manual.
- No performance figures are quoted unless measured in our own recorded demo runs, with sample size.
- Demo security (shared group key, plaintext coarse location) is demo-grade and disclosed as such.

## Repository layout

```
docs/
  architecture.md     system architecture, components, platform decision
  mesh-protocol.md    packet formats, routing rules, Android gotchas
  backend.md          Supabase schema and APIs
  demo-and-tasks.md   demo script, schedule, task sheet (V01-V20)
  frontend.md         rider/station app screens and the admin portal
  vehicle-integration.md  how a scooter plugs in (API, RangeCheck, holds)
  api/vehicle-api.yaml    OpenAPI spec for the vehicle API
  database-clustering.md  PostGIS spatial clustering for the map
  risks.md            weak points, principles, rules for AI agents, open questions
```

Code: `backend/` (Supabase), `dashboard/` (fleet web UI). `app/` (rider/station app) is not created yet.

## Rules for AI agents working here

1. Read `docs/` fully before writing code.
2. Keep the Router transport-agnostic and unit-testable with fake transports.
3. Never fabricate test results, delivery rates, battery figures or user numbers.
4. Smallest independently testable piece first; confirm on real phones before building on it.

## Status

Initial docs only. All tasks (V01-V20) not started; see `docs/demo-and-tasks.md`.
