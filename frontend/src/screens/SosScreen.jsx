/**
 * VoltMesh SOS Emergency Dispatch Screen (React Native JS)
 * Specification: VoltMesh Architecture Bible (Page 8, 14)
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { CATEGORIES } from '../services/PacketCodec';

export function SosScreen({ router, navigation }) {
  const [activeSOS, setActiveSOS] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState('IDLE');

  const triggerSOS = (category, label) => {
    if (!router) {
      Alert.alert('Demo Error', 'MeshRouter instance not initialized.');
      return;
    }

    const { msgId, packet } = router.createSOSPacket({
      category,
      priority: 3,
      lat: 25.2677,
      lon: 82.9913,
      bulkAvailable: true,
    });

    setActiveSOS({ msgId, label, packet });
    setDispatchStatus('BROADCASTING');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back to Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Offline Emergency SOS</Text>
      </View>

      {dispatchStatus === 'BROADCASTING' && activeSOS ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>🚨 SOS ALERT BROADCASTING</Text>
          <Text style={styles.activeType}>Category: {activeSOS.label}</Text>
          <Text style={styles.msgId}>MsgID: #{activeSOS.msgId}</Text>
          <Text style={styles.statusText}>
            Broadcasting 24-byte packet over BLE... Hosting payload over Wi-Fi Direct (SSID: DIRECT-VM-{activeSOS.msgId.toString(16)})...
          </Text>

          <View style={styles.pathBox}>
            <Text style={styles.pathTitle}>Multi-Hop Relay Status:</Text>
            <Text style={styles.pathText}>Node #{router.nodeId} (Origin) → Rebroadcasting to nearby peers</Text>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setDispatchStatus('IDLE');
              setActiveSOS(null);
            }}
          >
            <Text style={styles.cancelText}>Cancel SOS Alert</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          <Text style={styles.prompt}>Select emergency situation:</Text>

          <TouchableOpacity
            style={[styles.sosOption, { backgroundColor: '#EF4444' }]}
            onPress={() => triggerSOS(CATEGORIES.STRANDED, 'Stranded Rider')}
          >
            <Text style={styles.optionTitle}>🛵 Stranded Rider</Text>
            <Text style={styles.optionSub}>Out of battery with no reachable station</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sosOption, { backgroundColor: '#DC2626' }]}
            onPress={() => triggerSOS(CATEGORIES.THERMAL, 'Battery Overheating / Fire')}
          >
            <Text style={styles.optionTitle}>🔥 Battery Thermal / Fire</Text>
            <Text style={styles.optionSub}>Pack overheating or smoke detected</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sosOption, { backgroundColor: '#B91C1C' }]}
            onPress={() => triggerSOS(CATEGORIES.CRASH, 'Crash Event')}
          >
            <Text style={styles.optionTitle}>💥 Crash Event</Text>
            <Text style={styles.optionSub}>Severe impact or collision</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sosOption, { backgroundColor: '#4B5563' }]}
            onPress={() => triggerSOS(CATEGORIES.MANUAL, 'Other Distress')}
          >
            <Text style={styles.optionTitle}>🆘 Other Distress</Text>
            <Text style={styles.optionSub}>Medical or safety emergency</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { color: '#60A5FA', fontSize: 16, marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  prompt: { fontSize: 15, color: '#9CA3AF', marginBottom: 20 },
  gridContainer: { flex: 1, justifyContent: 'center' },
  sosOption: { padding: 20, borderRadius: 16, marginBottom: 14 },
  optionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  optionSub: { color: '#FEE2E2', fontSize: 13, marginTop: 4 },
  activeCard: { backgroundColor: '#1F2937', padding: 22, borderRadius: 16, borderWidth: 2, borderColor: '#EF4444' },
  activeTitle: { color: '#EF4444', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  activeType: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginTop: 6 },
  msgId: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 2 },
  statusText: { color: '#D1D5DB', fontSize: 13, marginTop: 14, textAlign: 'center' },
  pathBox: { backgroundColor: '#111827', padding: 14, borderRadius: 10, marginTop: 16 },
  pathTitle: { color: '#60A5FA', fontWeight: 'bold', fontSize: 13 },
  pathText: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  cancelButton: { marginTop: 20, backgroundColor: '#374151', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelText: { color: '#F3F4F6', fontWeight: 'bold' },
});