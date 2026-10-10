# Weak Points, Principles and Rules

## Product weak points

| Weak point | Why it hurts | Answer |
|------------|--------------|--------|
| Cold start: mesh needs density | Few riders nearby, nothing relays | Everyday stock value keeps app on; fleets/swap networks roll out to all riders |
| Battery % typed by rider | Warnings only as good as input | Honest: BMS reading is future and maker-dependent; slider is the hackathon proxy |
| Range estimate is crude | Real range depends on load, speed, terrain | Simple per-scooter km-per-% figure with safety margin; say it's a heuristic |
| "Powered by the EV" | Many budget scooters lack USB | "Powered" = phone charging from any source; routing works without it, costs more battery |
| Who installs station phones | Gateways need operator buy-in | Riders routed to them, early warnings, one spare phone |
| Who actually helps | Peers aren't paramedics | Peers help with batteries; crashes/fires go to fleet and emergency services |
| Android only | iPhones can't relay | State it; delivery riders in India overwhelmingly use Android |

## Technical weak points

| Weak point | Why it hurts | Answer |
|------------|--------------|--------|
| Spoofed SOS or fake stock | Could lure a rider or strand them | Demo uses shared group key (weak, disclosed); production needs per-device keys signed by backend |
| Location in plaintext over BLE | Anyone scanning sees rough origin | Disclosed; production moves precise location into encrypted payload |
| Background killing (Xiaomi, Vivo, Oppo, Realme) | Relays silently stop | Foreground service; demo with screens on; OEM testing is future work |
| Battery drain on battery-only phones | Riders uninstall | Energy-aware windows; measure, don't claim |
| A and Station hear each other directly | Multi-hop not proven | Low tx power, distance, walls; relay log as proof; disclose any simulated topology |
| Wi-Fi Direct reliability | Dialogs, failed groups | P1 only; everything works on BLE |
| No real-world numbers | Judges ask "how well does it work?" | Quote only today's recorded runs, with sample size |

## Execution weak points

- Build starts 15:00, ~18 hours total. **P0 only until 01:00.**
- Kotlin + Compose skill is the critical dependency. If nobody has it, switch to Expo + native module now, not at midnight.
- Four Android 10+ phones required; confirm in V01.

## Principles

1. Everyday value first; safety rides on it.
2. Offline means it works with no internet until the gateway.
3. Multi-hop is shown with logs, not asserted.
4. Charging phones do the heavy relaying; battery phones do the minimum.
5. An alert reaching a station is not help arriving; status changes come from people.
6. Demo-grade security is disclosed as such.
7. Nothing from Sentinel's code, data or brand is used.

## Rules for any AI model building on this

- BLE for discovery and compact data; Wi-Fi Direct for payloads. No other transport.
- Mesh code is native Kotlin inside `MeshService`; never browser JavaScript.
- Keep the Router transport-agnostic and unit-testable with fake transports.
- Never invent measurements, rider counts, range figures or delivery rates; don't quote failure-frequency numbers until sourced.
- Smallest working piece first; confirm on real phones before building on it.

## Open questions

- Final product name (VoltMesh is a placeholder)
- Team size, and who knows Kotlin + Compose
- Four Android 10+ phones available?
- SHIFT rules on separate projects and IP ownership (team, Arav, or Secured Systems)
- Range figure per % battery for the demo scooter profile
