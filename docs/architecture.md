# Architecture

## Overview

Rider phones relay over BLE and Wi-Fi Direct; the swap station is the gateway (only it needs internet); Supabase feeds the fleet dashboard.

```
 Rider A ──BLE──> Rider B ──BLE──> Rider C ──BLE──> Station (gateway) ──HTTPS──> Supabase ──realtime──> Fleet dashboard
 (battery)       (charging)       (charging)       (power+internet)
        - - - - Wi-Fi Direct (bulk payload, optional) - - - -
```

Solid = BLE (alerts, battery stock). Dashed = Wi-Fi Direct payload.

## Components

| Component | Runs on | Built with |
|-----------|---------|------------|
| VoltMesh app (rider + station modes) | Android phones | Kotlin + Jetpack Compose |
| MeshService (BLE + Wi-Fi Direct) | Inside the app, foreground service | Android Bluetooth and Wi-Fi P2P APIs |
| Fleet dashboard | Laptop browser | React + Vite + Leaflet |
| Backend | Cloud | New Supabase project: Postgres, Edge Functions, Realtime, Storage |

## Users

| User | Device | Does |
|------|--------|------|
| Rider | Android phone on scooter | Sees nearby stock offline; sets battery %; sends/relays alerts |
| Swap station operator | Android phone/tablet on power + internet | Broadcasts stock; mesh gateway; sees warnings/SOS; marks "help sent" |
| Fleet operator | Laptop browser | Live map of riders, stations, stock, alerts, relay paths |

Stations benefit: riders routed to them, early stranding visibility, a gateway that costs one spare Android phone.

## Platform decision

Only native code can advertise over BLE and use Wi-Fi Direct.

| Capability | Chrome on Android | Native Android |
|------------|-------------------|----------------|
| BLE advertising | Not available | `BluetoothLeAdvertiser` |
| BLE scanning | Experimental flag only | `BluetoothLeScanner` |
| Wi-Fi Direct | Not available | `WifiP2pManager` |
| Relay with screen off | No | Foreground service |

Options: WebView + JS bridge (rejected), React Native/Expo + native module (fallback only if no one knows Compose), **Kotlin + Compose (chosen)**, web dashboard (chosen for fleets). Re-check Web Bluetooth status before relying on any change.

## App stack

| Layer | Choice | Why |
|-------|--------|-----|
| App | Kotlin, Compose, single Activity, min SDK 29 | Wi-Fi Direct config builder needs API 29 |
| Background | Foreground `MeshService` (`connectedDevice` type) | Relays with screen off |
| Local storage | Room (or SQLite) | Carried alerts, cached stock, relay log |
| Maps | osmdroid, pre-cached tiles | Offline, no API key |
| Backend client | Supabase Kotlin client or Ktor/OkHttp | Gateway upload, provisioning |

## App structure

| Unit | Job |
|------|-----|
| MeshService | Owns radios, router and store; exposes `StateFlow` to the UI |
| PacketCodec | Encode/decode 24-byte packets; HMAC tag; unit-tested |
| BleAdvertiser / BleScanner | Round-robin advertising; one long-running filtered scan |
| WifiDirectHost / WifiDirectClient | Derived-credential groups; TCP payload transfer |
| Router | Dedup, TTL, hop limit, energy-aware windows, store-carry-forward; tested with fake transports |
| RangeCheck | Battery % x per-scooter range vs distance to stations; raises low-battery warning |
| Gateway | When online/station: upload alerts and stock, flood ACKs |
| Store | Room tables: alerts, stations, relay log |

The Compose UI collects MeshService state directly (no JS bridge).

## Screens

**Rider:** Home (battery slider, est. range, nearby stations with stock + "last heard X min ago", SOS button) · SOS (Stranded default; Crash, Battery overheating/fire, Other) · Nearby alerts (distance, hops, "I can help") · Mesh (peers, charging, station in reach, relay log: msgId, hop, prev relay, RSSI, transport; the demo proof screen).

**Station:** Stock (+/-, broadcast and upload) · Incoming (warnings/SOS, "help sent", "battery held") · Gateway status.

**Fleet dashboard:** Live map (riders, stations + stock, open warnings/alerts) · Alert card (category, time, relay path A -> B -> C -> Station, time to backend, status) · Counts from today's runs only.

## Alert routing summary

| Alert | Goes to | Realistic help |
|-------|---------|----------------|
| Low-battery warning | Nearest station | Hold a battery, guide rider in |
| Stranded | Nearby riders + nearest station | Rider/staff brings charged battery |
| Battery overheating/fire | Everyone in range + fleet | Move away; fleet calls emergency services |
| Crash | Everyone in range + fleet | Fleet calls emergency services; peers stay with rider |

## Separation from Sentinel

New repo, new Supabase project, own branding. No imports, tables, users, keys, logos or domains from Sentinel. Sentinel's papers are not cited as VoltMesh evidence. Decide before submission who owns VoltMesh IP and whether SHIFT rules say anything.
