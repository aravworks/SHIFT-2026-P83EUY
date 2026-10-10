/**
 * VoltMesh Application Main Entry Point (React Native JS)
 * Specification: VoltMesh Architecture Bible
 * Frontend Navigation & State Wire-up
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MeshRouter } from './services/MeshRouter';
import { HomeScreen } from './screens/HomeScreen';
import { SosScreen } from './screens/SosScreen';
import { NearbyAlertsScreen } from './screens/NearbyAlertsScreen';
import { StationModeScreen } from './screens/StationModeScreen';
import { MeshLogScreen } from './screens/MeshLogScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState('HOME');
  const [nodeId] = useState(() => Math.floor(1000 + Math.random() * 9000));

  // Initialize central JavaScript MeshRouter
  const router = useMemo(() => {
    const r = new MeshRouter({ nodeId, isStation: false });
    
    // Simulate initial station stock packet for demo testing
    setTimeout(() => {
      const { PacketCodec } = require('./services/PacketCodec');
      const u8 = PacketCodec.encodeStockPacket({
        stockVersion: 1,
        stationNodeId: 901,
        lat: 25.2680,
        lon: 82.9920,
        batteriesAvailable: 4,
      });
      r.processIncomingPacket(u8, -58, 'BLE');
    }, 800);

    return r;
  }, [nodeId]);

  const navigationMock = {
    navigate: (screenName) => setCurrentTab(screenName),
    goBack: () => setCurrentTab('HOME'),
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Dynamic Screen Container */}
      <View style={styles.body}>
        {currentTab === 'HOME' && <HomeScreen router={router} navigation={navigationMock} />}
        {currentTab === 'SOS' && <SosScreen router={router} navigation={navigationMock} />}
        {currentTab === 'NEARBY' && <NearbyAlertsScreen router={router} navigation={navigationMock} />}
        {currentTab === 'STATION' && <StationModeScreen router={router} navigation={navigationMock} />}
        {currentTab === 'LOGS' && <MeshLogScreen router={router} navigation={navigationMock} />}
      </View>

      {/* Responsive Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'HOME' && styles.tabActive]}
          onPress={() => setCurrentTab('HOME')}
        >
          <Text style={[styles.tabText, currentTab === 'HOME' && styles.tabTextActive]}>🛵 Rider</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'SOS' && styles.tabActive]}
          onPress={() => setCurrentTab('SOS')}
        >
          <Text style={[styles.tabText, currentTab === 'SOS' && styles.tabTextActive]}>🚨 SOS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'NEARBY' && styles.tabActive]}
          onPress={() => setCurrentTab('NEARBY')}
        >
          <Text style={[styles.tabText, currentTab === 'NEARBY' && styles.tabTextActive]}>🤝 Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'STATION' && styles.tabActive]}
          onPress={() => setCurrentTab('STATION')}
        >
          <Text style={[styles.tabText, currentTab === 'STATION' && styles.tabTextActive]}>⚡ Station</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'LOGS' && styles.tabActive]}
          onPress={() => setCurrentTab('LOGS')}
        >
          <Text style={[styles.tabText, currentTab === 'LOGS' && styles.tabTextActive]}>📊 Logs</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  body: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1F2937', borderTopWidth: 1, borderTopColor: '#374151', paddingVertical: 10 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#10B981' },
  tabText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#10B981', fontWeight: 'bold' },
});