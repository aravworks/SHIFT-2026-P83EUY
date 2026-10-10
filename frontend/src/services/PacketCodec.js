/**
 * VoltMesh 24-Byte Binary Packet Codec (JavaScript)
 * Specification: VoltMesh Architecture Bible (Pages 9-10)
 */
import CryptoJS from 'crypto-js';

export const PACKET_TYPES = {
  STOCK: 0,
  SOS: 1,
  ACK: 2,
};

export const CATEGORIES = {
  STRANDED: 0,
  THERMAL: 1,
  CRASH: 2,
  MANUAL: 3,
};

export class PacketCodec {
  static encodeSOSPacket({
    version = 1,
    bulkAvailable = false,
    type = PACKET_TYPES.SOS,
    msgId = Math.floor(Math.random() * 4294967295),
    originId,
    hop = 0,
    maxHop = 4,
    prevHopId,
    createdAt = Math.floor(Date.now() / 1000),
    lat = 25.2677,
    lon = 82.9913,
    category = CATEGORIES.STRANDED,
    priority = 0,
    groupKey = 'VoltMeshDemoSecretKey2026',
  }) {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);

    const byte0 = ((version & 0x07) << 5) | ((bulkAvailable ? 1 : 0) << 4) | (type & 0x0f);
    view.setUint8(0, byte0);
    view.setUint32(1, msgId >>> 0, false);
    view.setUint16(5, originId & 0xffff, false);

    const byte7 = ((hop & 0x0f) << 4) | (maxHop & 0x0f);
    view.setUint8(7, byte7);
    view.setUint16(8, (prevHopId || originId) & 0xffff, false);
    view.setUint32(10, createdAt >>> 0, false);

    PacketCodec._writeInt24(view, 14, Math.round(lat * 10000));
    PacketCodec._writeInt24(view, 17, Math.round(lon * 10000));

    const byte20 = ((category & 0x0f) << 4) | (priority & 0x0f);
    view.setUint8(20, byte20);

    const hmacTag = PacketCodec.computeHMAC(new Uint8Array(buffer, 0, 21), groupKey);
    const u8 = new Uint8Array(buffer);
    u8[21] = hmacTag[0];
    u8[22] = hmacTag[1];
    u8[23] = hmacTag[2];

    return u8;
  }

  static encodeStockPacket({
    version = 1,
    stockVersion = 1,
    stationNodeId,
    hop = 0,
    maxHop = 3,
    prevHopId,
    updatedAt = Math.floor(Date.now() / 1000),
    lat = 25.2680,
    lon = 82.9920,
    batteriesAvailable = 4,
    groupKey = 'VoltMeshDemoSecretKey2026',
  }) {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);

    const byte0 = ((version & 0x07) << 5) | (0 << 4) | (PACKET_TYPES.STOCK & 0x0f);
    view.setUint8(0, byte0);
    view.setUint32(1, stockVersion >>> 0, false);
    view.setUint16(5, stationNodeId & 0xffff, false);

    const byte7 = ((hop & 0x0f) << 4) | (maxHop & 0x0f);
    view.setUint8(7, byte7);
    view.setUint16(8, (prevHopId || stationNodeId) & 0xffff, false);
    view.setUint32(10, updatedAt >>> 0, false);

    PacketCodec._writeInt24(view, 14, Math.round(lat * 10000));
    PacketCodec._writeInt24(view, 17, Math.round(lon * 10000));

    view.setUint8(20, Math.min(255, Math.max(0, batteriesAvailable)));

    const hmacTag = PacketCodec.computeHMAC(new Uint8Array(buffer, 0, 21), groupKey);
    const u8 = new Uint8Array(buffer);
    u8[21] = hmacTag[0];
    u8[22] = hmacTag[1];
    u8[23] = hmacTag[2];

    return u8;
  }

  static decodePacket(uint8Array, groupKey = 'VoltMeshDemoSecretKey2026') {
    if (!uint8Array || uint8Array.length < 24) {
      throw new Error('Invalid packet size: expected 24 bytes');
    }

    const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, 24);
    const calculatedTag = PacketCodec.computeHMAC(uint8Array.subarray(0, 21), groupKey);
    const isValidTag =
      uint8Array[21] === calculatedTag[0] &&
      uint8Array[22] === calculatedTag[1] &&
      uint8Array[23] === calculatedTag[2];

    const byte0 = view.getUint8(0);
    const version = (byte0 >> 5) & 0x07;
    const bulkAvailable = ((byte0 >> 4) & 0x01) === 1;
    const type = byte0 & 0x0f;

    const byte7 = view.getUint8(7);
    const hop = (byte7 >> 4) & 0x0f;
    const maxHop = byte7 & 0x0f;

    const prevHopId = view.getUint16(8, false);
    const timestamp = view.getUint32(10, false);

    const lat = PacketCodec._readInt24(view, 14) / 10000;
    const lon = PacketCodec._readInt24(view, 17) / 10000;

    const baseHeader = {
      version,
      bulkAvailable,
      type,
      hop,
      maxHop,
      prevHopId,
      timestamp,
      lat,
      lon,
      isValidTag,
    };

    if (type === PACKET_TYPES.STOCK) {
      return {
        ...baseHeader,
        stockVersion: view.getUint32(1, false),
        stationNodeId: view.getUint16(5, false),
        batteriesAvailable: view.getUint8(20),
      };
    } else {
      const byte20 = view.getUint8(20);
      return {
        ...baseHeader,
        msgId: view.getUint32(1, false),
        originId: view.getUint16(5, false),
        category: (byte20 >> 4) & 0x0f,
        priority: byte20 & 0x0f,
      };
    }
  }

  static computeHMAC(payloadUint8Array, key) {
    const wordArray = CryptoJS.lib.WordArray.create(payloadUint8Array);
    const hmacHex = CryptoJS.HmacSHA256(wordArray, key).toString(CryptoJS.enc.Hex);
    return [
      parseInt(hmacHex.substring(0, 2), 16),
      parseInt(hmacHex.substring(2, 4), 16),
      parseInt(hmacHex.substring(4, 6), 16),
    ];
  }

  static _writeInt24(dataView, offset, value) {
    const clamped = Math.max(-8388608, Math.min(8388607, value));
    const uval = clamped < 0 ? clamped + 16777216 : clamped;
    dataView.setUint8(offset, (uval >> 16) & 0xff);
    dataView.setUint8(offset + 1, (uval >> 8) & 0xff);
    dataView.setUint8(offset + 2, uval & 0xff);
  }

  static _readInt24(dataView, offset) {
    const b0 = dataView.getUint8(offset);
    const b1 = dataView.getUint8(offset + 1);
    const b2 = dataView.getUint8(offset + 2);
    let val = (b0 << 16) | (b1 << 8) | b2;
    if (val & 0x800000) val -= 16777216;
    return val;
  }
}