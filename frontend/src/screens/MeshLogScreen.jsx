/**
 * VoltMesh Forensic Relay Trace Log Screen (React Native JS)
 * Specification: VoltMesh Architecture Bible (Page 8, 14, 16)
 * Frontend UI: Real-time Multi-Hop Audit Stream & Proof Inspector
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';

export function MeshLogScreen({ router }) {
  const [meshState, setMeshState] = useState(router ? router.getStateSummary() : {});

  useEffect(() => {
    if (!router) return;
    const unsubscribe = router.subscribe((newState) => {
      setMeshState(newState);
    });
    return unsubscribe;
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Forensic Mesh Relay Log</Text>
          <Text style={styles.subTitle}>Hackathon Multi-Hop Proof Trace (Node #{router ? router.nodeId : 'Local'})</Text>
        </View>

        {/* Live Metrics Summary */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{meshState.carriedAlertsCount || 0}</Text>
            <Text style={styles.metricLbl}>Carried Alerts</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{meshState.cachedStations ? meshState.cachedStations.length : 0}</Text>
            <Text style={styles.metricLbl}>Stations in Reach</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{meshState.relayLogs ? meshState.relayLogs.length : 0}</Text>
            <Text style={styles.metricLbl}>Log Receipts</Text>
          </View>
        </View>

        {/* Audit Stream Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time Audit Stream (BLE / Wi-Fi Direct Receipts)</Text>
          {(!meshState.relayLogs || meshState.relayLogs.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No packets received or relayed yet. Logs are recorded on every BLE scan receipt.</Text>
            </View>
          ) : (
            meshState.relayLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logTime}>{log.timestamp}</Text>
                  <Text style={[styles.logType, log.type === 'SOS' ? styles.typeSos : styles.typeStock]}>
                    {log.type}
                  </Text>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logAction}>
                    {log.action} • MsgID: #{log.msgId}
                  </Text>
                  <Text style={styles.logDetails}>
                    Hop {log.hop} via Node #{log.prevHopId} • {log.transport} ({log.rssi} dBm)
                  </Text>
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
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC' },
  subTitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, alignItems: 'center' },
  metricVal: { fontSize: 22, fontWeight: 'bold', color: '#38BDF8' },
  metricLbl: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 10 },
  emptyCard: { backgroundColor: '#1E293B', padding: 20, borderRadius: 10, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center' },
  logRow: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  logLeft: { width: 80, justifyContent: 'center' },
  logTime: { color: '#94A3B8', fontSize: 11 },
  logType: { fontWeight: 'bold', fontSize: 11, marginTop: 2 },
  typeSos: { color: '#F87171' },
  typeStock: { color: '#34D399' },
  logRight: { flex: 1, paddingLeft: 10 },
  logAction: { color: '#F8FAFC', fontWeight: 'bold', fontSize: 13 },
  logDetails: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
});