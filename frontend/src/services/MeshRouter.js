/**
 * VoltMesh Transport-Agnostic Store-Carry-Forward Router (JavaScript)
 * Specification: VoltMesh Architecture Bible (Pages 10, 11, 16)
 */
import { PacketCodec, PACKET_TYPES } from './PacketCodec';

export class MeshRouter {
  constructor({ nodeId, isStation = false, groupKey = 'VoltMeshDemoSecretKey2026' }) {
    this.nodeId = nodeId;
    this.isStation = isStation;
    this.groupKey = groupKey;
    this.isPowered = false;

    this.seenMsgIds = new Map();
    this.carriedAlerts = new Map();
    this.cachedStations = new Map();
    this.relayLogs = [];

    this.TTL_SECONDS = 600;
    this.MAX_STORE_CAP = 50;

    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notifyListeners() {
    const state = this.getStateSummary();
    this.listeners.forEach((cb) => cb(state));
  }

  processIncomingPacket(rawUint8Array, rssi = -65, transport = 'BLE') {
    let packet;
    try {
      packet = PacketCodec.decodePacket(rawUint8Array, this.groupKey);
    } catch (err) {
      return { status: 'INVALID_PACKET' };
    }

    if (!packet.isValidTag) return { status: 'INVALID_TAG' };

    const now = Math.floor(Date.now() / 1000);
    if (now - packet.timestamp > this.TTL_SECONDS) return { status: 'EXPIRED' };

    if (packet.type === PACKET_TYPES.ACK) {
      this.carriedAlerts.delete(packet.msgId);
      this._addRelayLog(packet, rssi, transport, 'ACK_RECEIVED');
      this.notifyListeners();
      return { status: 'ACK_PROCESSED', msgId: packet.msgId };
    }

    if (packet.type === PACKET_TYPES.STOCK) {
      const existing = this.cachedStations.get(packet.stationNodeId);
      if (!existing || packet.stockVersion > existing.stockVersion) {
        this.cachedStations.set(packet.stationNodeId, packet);
        this._addRelayLog(packet, rssi, transport, 'STOCK_UPDATED');
        this.notifyListeners();
        return { status: 'STOCK_STORED', stationNodeId: packet.stationNodeId };
      }
      return { status: 'STALE_STOCK' };
    }

    if (packet.type === PACKET_TYPES.SOS) {
      const isDuplicate = this.seenMsgIds.has(packet.msgId);
      this.seenMsgIds.set(packet.msgId, now);

      this._addRelayLog(packet, rssi, transport, isDuplicate ? 'DUPLICATE' : 'NEW_ALERT');
      if (isDuplicate) return { status: 'DUPLICATE_LOGGED' };
      if (packet.hop >= packet.maxHop) return { status: 'MAX_HOPS_REACHED' };

      if (this.carriedAlerts.size >= this.MAX_STORE_CAP) {
        const oldestKey = this.carriedAlerts.keys().next().value;
        this.carriedAlerts.delete(oldestKey);
      }

      const rebroadcastPacket = {
        ...packet,
        hop: packet.hop + 1,
        prevHopId: this.nodeId,
      };

      this.carriedAlerts.set(packet.msgId, rebroadcastPacket);
      this.notifyListeners();
      return { status: 'STORED_FOR_RELAY', rebroadcastPacket };
    }

    return { status: 'UNKNOWN_TYPE' };
  }

  createSOSPacket({ category, priority, lat, lon, bulkAvailable = false }) {
    const msgId = Math.floor(Math.random() * 4294967295);
    const u8 = PacketCodec.encodeSOSPacket({
      msgId,
      originId: this.nodeId,
      hop: 0,
      maxHop: 4,
      prevHopId: this.nodeId,
      createdAt: Math.floor(Date.now() / 1000),
      lat,
      lon,
      category,
      priority,
      bulkAvailable,
      groupKey: this.groupKey,
    });

    const decoded = PacketCodec.decodePacket(u8, this.groupKey);
    this.carriedAlerts.set(msgId, decoded);
    this.seenMsgIds.set(msgId, Math.floor(Date.now() / 1000));
    this._addRelayLog(decoded, 0, 'LOCAL_ORIGIN', 'CREATED');
    this.notifyListeners();

    return { msgId, rawBytes: u8, packet: decoded };
  }

  getStateSummary() {
    return {
      nodeId: this.nodeId,
      isStation: this.isStation,
      isPowered: this.isPowered,
      carriedAlertsCount: this.carriedAlerts.size,
      carriedAlerts: Array.from(this.carriedAlerts.values()),
      cachedStations: Array.from(this.cachedStations.values()),
      relayLogs: this.relayLogs.slice(0, 30),
    };
  }

  _addRelayLog(packet, rssi, transport, action) {
    this.relayLogs.unshift({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      msgId: packet.msgId || packet.stockVersion,
      originId: packet.originId || packet.stationNodeId,
      hop: packet.hop,
      prevHopId: packet.prevHopId,
      rssi,
      transport,
      action,
      type: packet.type === PACKET_TYPES.STOCK ? 'STOCK' : packet.type === PACKET_TYPES.ACK ? 'ACK' : 'SOS',
    });

    if (this.relayLogs.length > 100) this.relayLogs.pop();
  }
}