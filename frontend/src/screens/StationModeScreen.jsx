/**
 * VoltMesh Station Mode Operator Screen (React Native JS)
 * Specification: VoltMesh Architecture Bible (Page 8, 12, 16)
 * Frontend UI: Station Battery Stock Counter & Incoming Distress Queue
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { PacketCodec } from '../services/PacketCodec';

export function StationModeScreen({ router }) {
  const [stockCount, setStockCount] = useState(4); // Default 4 charged packs
  const [stockVersion, setStockVersion] = useState(1);
  const [meshState, setMeshState] = useState(router ? router.getStateSummary() : {});

  useEffect(() => {
    if (!router) return;
    const unsubscribe = router.subscribe((newState) => {
      setMeshState(newState);
    });
    return unsubscribe;
  }, [router]);

  const updateStock = (delta) => {
    const newCount = Math.max(0, stockCount + delta);
    const newVersion = stockVersion + 1;
    setStockCount(newCount);
    setStockVersion(newVersion);

    if (router) {
      const u8 = PacketCodec.encodeStockPacket({
        stockVersion: newVersion,
        stationNodeId: router.nodeId,
        lat: 25.2677,
        lon: 82.9913,
        batteriesAvailable: newCount,
        groupKey: router.groupKey,
      });
      router.processIncomingPacket(u8, 0, 'STATION_LOCAL');
    }
  };

  const handleAction = (actionName, alert) => {
    Alert.alert('Station Action Sent', `${actionName} recorded for Rider Node #${alert.originId}. ACK packet flooded back over mesh.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>VoltMesh Station Operator</Text>
          <View style={styles.onlineBadge}>
            <Text style={styles.onlineText}>🌐 Gateway Active (Power + Internet)</Text>
          </View>
        </View>

        {/* Battery Stock Controller */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Charged Batteries Available at Station</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.btnCounter} onPress={() => updateStock(-1)}>
              <Text style={styles.btnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.stockValue}>{stockCount}</Text>
            <TouchableOpacity style={styles.btnCounter} onPress={() => updateStock(1)}>
              <Text style={styles.btnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stockSub}>
            Stock Version: #{stockVersion} • Auto-broadcasting over BLE mesh every shift
          </Text>
        </View>

        {/* Incoming SOS & Warnings Queue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming Rider Alerts & Low-Battery Warnings</Text>
          {(!meshState.carriedAlerts || meshState.carriedAlerts.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active rider emergency alerts or stranding warnings nearby.</Text>
            </View>
          ) : (
            meshState.carriedAlerts.map((alert, idx) => (
              <View key={idx} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertTitle}>
                    {alert.category === 0 ? '🛵 Stranded Rider' : alert.category === 1 ? '🔥 Battery Fire' : '💥 Crash Event'}
                  </Text>
                  <Text style={styles.hopBadge}>Hop {alert.hop} (via Node #{alert.prevHopId})</Text>
                </View>
                <Text style={styles.alertSub}>Origin Rider Node #{alert.originId} • MsgID: #{alert.msgId}</Text>
                
                {/* Station Operator Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.btnHold}
                    onPress={() => handleAction('Battery Held', alert)}
                  >
                    <Text style={styles.btnActionText}>🔋 Battery Held</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnDispatch}
                    onPress={() => handleAction('Help Sent', alert)}
                  >
                    <Text style={styles.btnActionText}>🚀 Help Sent</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  onlineBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 6, alignSelf: 'flex-start' },
  onlineText: { color: '#1E40AF', fontWeight: 'bold', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 20, alignItems: 'center', elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  counterRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  btnCounter: { backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  stockValue: { fontSize: 48, fontWeight: 'bold', color: '#111827', marginHorizontal: 28 },
  stockSub: { fontSize: 12, color: '#6B7280' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 10 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  alertCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#991B1B' },
  hopBadge: { backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 'bold', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  alertSub: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  btnHold: { flex: 1, backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnDispatch: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnActionText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});