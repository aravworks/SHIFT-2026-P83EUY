/**
 * VoltMesh Nearby Alerts & Peer Assistance Screen (React Native JS)
 * Specification: VoltMesh Architecture Bible (Page 8)
 * Frontend UI: Active Peer Emergency Feed & "I Can Help" Peer Response
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';

export function NearbyAlertsScreen({ router }) {
  const [meshState, setMeshState] = useState(router ? router.getStateSummary() : {});

  useEffect(() => {
    if (!router) return;
    const unsubscribe = router.subscribe((newState) => {
      setMeshState(newState);
    });
    return unsubscribe;
  }, [router]);

  const handleHelpPeer = (alert) => {
    Alert.alert(
      'Peer Assistance Offered',
      `You accepted to help Rider Node #${alert.originId} (${alert.category === 0 ? 'Stranded' : 'Emergency'}). Bringing assistance or battery pack!`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Nearby Peer Emergency Alerts</Text>
          <Text style={styles.subTitle}>Relayed via Offline Mesh (Rider-to-Rider)</Text>
        </View>

        {(!meshState.carriedAlerts || meshState.carriedAlerts.length === 0) ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>🟢 All Clear Nearby</Text>
            <Text style={styles.emptyText}>No nearby riders are currently broadcasting emergency alerts or stranding warnings.</Text>
          </View>
        ) : (
          meshState.carriedAlerts.map((alert, idx) => (
            <View key={idx} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTitle}>
                  {alert.category === 0 ? '🛵 Stranded Rider' : alert.category === 1 ? '🔥 Battery Fire' : '💥 Crash Event'}
                </Text>
                <View style={styles.hopBadge}>
                  <Text style={styles.hopText}>Hop {alert.hop}</Text>
                </View>
              </View>

              <Text style={styles.alertMeta}>
                Origin Node: <Text style={styles.bold}>#{alert.originId}</Text> • MsgID: #{alert.msgId}
              </Text>
              <Text style={styles.alertDetails}>
                Location: ({alert.lat.toFixed(4)}, {alert.lon.toFixed(4)}) • Prev Relay Node: #{alert.prevHopId}
              </Text>

              <TouchableOpacity
                style={styles.helpButton}
                activeOpacity={0.8}
                onPress={() => handleHelpPeer(alert)}
              >
                <Text style={styles.helpButtonText}>🤝 I CAN HELP THIS RIDER</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  subTitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#059669', marginBottom: 6 },
  emptyText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  alertCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FCA5A5', elevation: 2 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#991B1B' },
  hopBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hopText: { color: '#991B1B', fontWeight: 'bold', fontSize: 12 },
  alertMeta: { color: '#374151', fontSize: 13, marginTop: 6 },
  bold: { fontWeight: 'bold', color: '#111827' },
  alertDetails: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  helpButton: { backgroundColor: '#059669', marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  helpButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});