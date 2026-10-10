// Server-side decoder for the 24-byte mesh packet (docs/mesh-protocol.md).
// MUST stay byte-compatible with the Android PacketCodec (task V04).
// Type numbers and the tag input ranges are not fixed by the spec yet:
// agree them with the PacketCodec owner and update both sides together.

export const PACKET_LEN = 24;

export const PacketType = { BEACON: 0, SOS: 1, WARNING: 2, STOCK: 3, ACK: 4 } as const;

const CATEGORY = ["stranded", "thermal", "crash", "other"] as const; // nibble 0..3 (3 = manual)

export interface Packet {
  version: number;
  bulkAvailable: boolean;
  type: number;
  msgId: number;
  originId: number;
  hop: number;
  maxHop: number;
  prevHopId: number;
  createdAt: number; // epoch seconds
  lat: number;
  lon: number;
  categoryNibble: number;
  priority: number;
  tag: Uint8Array;
  raw: Uint8Array;
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^([0-9a-fA-F]{2})+$/.test(hex)) throw new Error("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
function s24(b: Uint8Array, i: number) {
  const v = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
  return v & 0x800000 ? v - 0x1000000 : v;
}

export function decode(raw: Uint8Array): Packet {
  if (raw.length !== PACKET_LEN) throw new Error(`packet must be ${PACKET_LEN} bytes`);
  return {
    version: raw[0] >> 5,
    bulkAvailable: ((raw[0] >> 4) & 1) === 1,
    type: raw[0] & 0x0f,
    msgId: u32(raw, 1),
    originId: u16(raw, 5),
    hop: raw[7] >> 4,
    maxHop: raw[7] & 0x0f,
    prevHopId: u16(raw, 8),
    createdAt: u32(raw, 10),
    lat: s24(raw, 14) / 1e4,
    lon: s24(raw, 17) / 1e4,
    categoryNibble: raw[20] >> 4,
    priority: raw[20] & 0x0f,
    tag: raw.slice(21, 24),
    raw,
  };
}

/** Stock packets reuse the frame: stockVersion=bytes 1-4, stationNodeId=5-6, updatedAt=10-13, lat/lon=14-19, count=20. */
export function decodeStock(raw: Uint8Array) {
  return {
    stockVersion: u32(raw, 1),
    stationNodeId: u16(raw, 5),
    updatedAt: u32(raw, 10),
    lat: s24(raw, 14) / 1e4,
    lon: s24(raw, 17) / 1e4,
    batteriesAvailable: raw[20],
  };
}

export function categoryName(p: Packet): string {
  if (p.type === PacketType.WARNING) return "low_battery";
  return CATEGORY[p.categoryNibble] ?? "other";
}

/** Tag covers the immutable fields (everything except byte 0 flags, hop/maxHop, prevHopId, and the tag). */
export async function verifyTag(raw: Uint8Array, groupKey: string): Promise<boolean> {
  const signed = new Uint8Array(6 + 11);
  signed.set(raw.subarray(1, 7), 0); // msgId, originId
  signed.set(raw.subarray(10, 21), 6); // createdAt, lat, lon, category/priority
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(groupKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  let diff = 0;
  for (let i = 0; i < 3; i++) diff |= mac[i] ^ raw[21 + i];
  return diff === 0;
}
