/**
 * VoltMesh Home Screen (React Native JS)
 * Specification: VoltMesh Architecture Bible (Page 8)
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Slider, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { RangeCheck } from '../services/RangeCheck';

export function HomeScreen({ router, navigation }) {
  const [batteryPct, setBatteryPct] = useState(65);
  const [meshState, setMeshState] = useState(router ? router.getStateSummary() : {});
  const [currentLocation] = useState({ lat: 25.2677, lon: 82.9913 });

  useEffect(() => {
    if (!router) return;
    const unsubscribe = router.subscribe((newState) => {
      setMeshState(newState);
    });
    return unsubscribe;
  }, [router]);

  const estimatedRange = RangeCheck.calculateRemainingRange(batteryPct);
  const evaluation = RangeCheck.evaluateStrandingRisk({
    currentLat: currentLocation.lat,
    currentLon: currentLocation.lon,
    batteryPercentage: batteryPct,
    cachedStations: meshState.cachedStations || [],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>VoltMesh EV Rider</Text>
          <View style={[styles.badge, meshState.isPowered ? styles.badgePowered : styles.badgeBattery]}>
            <Text style={styles.badgeText}>
              {meshState.isPowered ? '⚡ Charging (Power Relay Active)' : '🔋 Battery Only (Energy Saver)'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scooter Battery Level</Text>
          <View style={styles.batteryDisplay}>
            <Text style={styles.batteryValue}>{batteryPct}%</Text>
            <View style={styles.rangeBox}>
              <Text style={styles.rangeVal}>{estimatedRange} km</Text>
              <Text style={styles.rangeLbl}>Est. Range</Text>
            </View>
          </View>
          
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={100}
            step={1}
            value={batteryPct}
            onValueChange={(val) => setBatteryPct(val)}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#D1D5DB"
            thumbTintColor="#059669"
          />

          {evaluation.isStrandingRisk && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningTitle}>⚠️ LOW-BATTERY STRANDING WARNING</Text>
              <Text style={styles.warningDesc}>
                No battery swap station with available stock is reachable within your remaining {estimatedRange} km range.
                Mesh network is auto-broadcasting distress alert!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Battery Swap Stock (Offline BLE Mesh)</Text>
          {(!meshState.cachedStations || meshState.cachedStations.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Scanning BLE beacons for station stock updates...</Text>
            </View>
          ) : (
            meshState.cachedStations.map((station, idx) => (
              <View key={idx} style={styles.stationCard}>
                <View style={styles.stationHeader}>
                  <Text style={styles.stationName}>Station Node #{station.stationNodeId}</Text>
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockBadgeText}>{station.batteriesAvailable} Charged Packs</Text>
                  </View>
                </View>
                <Text style={styles.stationSub}>
                  Location: ({station.lat.toFixed(4)}, {station.lon.toFixed(4)}) • Hop {station.hop} via Node #{station.prevHopId}
                </Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.sosButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SOS')}
        >
          <Text style={styles.sosButtonText}>🚨 EMERGENCY SOS</Text>
          <Text style={styles.sosButtonSub}>One-tap offline distress alert via BLE + Wi-Fi Direct</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 6, alignSelf: 'flex-start' },
  badgePowered: { backgroundColor: '#D1FAE5' },
  badgeBattery: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#065F46' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  batteryDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  batteryValue: { fontSize: 46, fontWeight: 'bold', color: '#059669' },
  rangeBox: { backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  rangeVal: { fontSize: 20, fontWeight: 'bold', color: '#047857' },
  rangeLbl: { fontSize: 11, color: '#065F46' },
  slider: { width: '100%', height: 40, marginTop: 8 },
  warningBanner: { backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, marginTop: 14, borderWidth: 1, borderColor: '#FCA5A5' },
  warningTitle: { color: '#991B1B', fontWeight: 'bold', fontSize: 14 },
  warningDesc: { color: '#B91C1C', fontSize: 13, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  stationCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stationName: { fontWeight: 'bold', fontSize: 15, color: '#111827' },
  stockBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stockBadgeText: { color: '#047857', fontWeight: 'bold', fontSize: 12 },
  stationSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  sosButton: { backgroundColor: '#DC2626', paddingVertical: 18, borderRadius: 16, alignItems: 'center', elevation: 6 },
  sosButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  sosButtonSub: { color: '#FCA5A5', fontSize: 12, marginTop: 4 },
});