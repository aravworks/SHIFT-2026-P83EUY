import { categoryName, decode, decodeStock, hexToBytes, PacketType, verifyTag } from "./packet.ts";

export interface Hop {
  node_id: number;
  hop: number;
  transport: "ble" | "wfd" | "gateway";
  powered?: boolean;
  rssi?: number;
  received_at?: string;
  /** Node that handed the packet to this one (the packet's prevHopId as this node saw it). */
  prev_node?: number;
  /** Whether this node's own HMAC check passed, as reported by the node. */
  tag_valid?: boolean;
}

export interface Item {
  packet_hex: string;
  ingress: "direct" | "mesh";
  hops?: Hop[];
  bulk_base64?: string;
}

// deno-lint-ignore no-explicit-any
type Db = any;

export type Result = { msg_id?: number; ok: boolean; reason?: string };

/** Verify, then upsert one packet. Idempotent on msg_id (mesh and direct copies dedup). */
export async function ingestItem(
  db: Db, item: Item, key: string, gatewayNode: number | null,
): Promise<Result> {
  let p;
  try {
    p = decode(hexToBytes(item.packet_hex));
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  if (!(await verifyTag(p.raw, key))) return { ok: false, reason: "bad tag" };

  if (p.type === PacketType.STOCK) {
    const s = decodeStock(p.raw);
    const { data: st } = await db.from("stations").select("stock_version").eq("node_id", s.stationNodeId).maybeSingle();
    if (!st) return { ok: false, reason: "unknown station" };
    if (st.stock_version !== null && st.stock_version >= s.stockVersion) return { ok: true, reason: "stale" };
    const { error } = await db.from("stations").update({
      batteries_available: s.batteriesAvailable,
      stock_version: s.stockVersion,
      stock_updated_at: new Date(s.updatedAt * 1000).toISOString(),
    }).eq("node_id", s.stationNodeId);
    return error ? { ok: false, reason: error.message } : { ok: true };
  }

  if (p.type !== PacketType.SOS && p.type !== PacketType.WARNING) {
    return { ok: true, reason: "ignored type" }; // beacons / ACKs are not stored
  }

  let bulkUri: string | null = null;
  if (item.bulk_base64) {
    bulkUri = `${p.msgId}.bin`;
    const bytes = Uint8Array.from(atob(item.bulk_base64), (c) => c.charCodeAt(0));
    const { error } = await db.storage.from("bulk").upload(bulkUri, bytes, { upsert: true });
    if (error) bulkUri = null;
  }

  // ignoreDuplicates: a later copy never resets status (help_sent/resolved) set by people.
  const { error } = await db.from("alerts").upsert({
    msg_id: p.msgId,
    origin_node: p.originId,
    category: categoryName(p),
    // 4-bit nibble, 0-15 (alerts_priority_valid). For warnings the nibble is the rider's battery in 10% steps.
    priority: p.priority,
    lat: p.lat,
    lon: p.lon,
    created_at: new Date(p.createdAt * 1000).toISOString(),
    ingress: item.ingress,
    gateway_node: gatewayNode,
    ...(bulkUri ? { bulk_uri: bulkUri } : {}),
  }, { onConflict: "msg_id", ignoreDuplicates: true });
  if (error) return { ok: false, reason: error.message };

  if (item.hops?.length) {
    const rows = item.hops.map((h) => ({
      msg_id: p.msgId,
      ...h,
      // The gateway hop is verified here: we checked the tag, and the packet itself names the last relay.
      ...(h.transport === "gateway"
        ? { tag_valid: h.tag_valid ?? true, prev_node: h.prev_node ?? p.prevHopId }
        : {}),
    }));
    const { error: hopErr } = await db.from("relay_hops").upsert(rows, { onConflict: "msg_id,node_id" });
    if (hopErr) return { ok: false, msg_id: p.msgId, reason: hopErr.message };
  }
  return { ok: true, msg_id: p.msgId };
}
