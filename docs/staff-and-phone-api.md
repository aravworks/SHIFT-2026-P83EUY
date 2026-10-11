# Staff and phone endpoints

Added after the vehicle API. All run on the same service (Render or Supabase Edge Functions).

## Migrations to apply (SQL editor, in order)

| File | Adds |
|---|---|
| `0005_help_offers.sql` | `help_offers` table (RLS: staff read; Realtime) |
| `0006_relay_hop_audit.sql` | `relay_hops.prev_node`, `relay_hops.tag_valid` |
| `0007_station_stock_adjust.sql` | `adjust_station_stock()` for the portal's +/- buttons |

Apply them before using the portal features below; the portal tolerates a missing `help_offers` table but its Realtime subscription will report an error until 0005 is applied.

## Portal actions (`/admin/...`, Bearer = signed-in user's JWT)

| Route | Roles | Body | Does |
|---|---|---|---|
| `POST /admin/alerts/:msg_id/hold` | admin, fleet, station | `{ station_id }` | "Battery held": creates a hold at that station linked to the alert. 409 if the alert already has an active hold, the station has no battery available, or the alert's vehicle already holds one |
| `POST /admin/stations/:id/stock` | admin, fleet, station | `{ delta }` or `{ set }` | Changes stock (0-255), bumps `stock_version`. Refuses to go below active holds (409) |
| `POST /admin/vehicles`, `.../rotate-key` | admin | see vehicle integration doc | Vehicle keys |

Limit: a stock change made in the portal updates the backend only. It does not broadcast over the mesh; the station phone's own broadcasts carry their own `stockVersion`, so the two can disagree until the phone app reads the backend value.

## Help offers (`POST /help`, from phones)

```json
{ "action": "offer", "alert_msg_id": 123, "helper_node": 7, "eta_minutes": 5, "sig": "<hex>" }
```

`sig` = hex HMAC-SHA256 with the shared group key over `help:<action>:<alert_msg_id>:<helper_node>`. `action` is `offer` (default) or `withdraw`. Demo-grade authentication, like the mesh packets. A rider cannot offer to help their own alert; resolved alerts are refused. Offers appear on the alert card in the portal.

## Relay log

`Hop` items in `POST /ingest` may include `prev_node` and `tag_valid`. For the `gateway` hop the server fills them itself: `tag_valid` from its own verification and `prev_node` from the packet's `prevHopId`. Phone-reported `tag_valid` values are the phone's claim, not verified by the server.

## Map

The red line on the Overview map runs from where the alert was raised to the receiving station, through any station hops. Relay phones have no stored location by design, so the line is schematic and the tooltip says so.
