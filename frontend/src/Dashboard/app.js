/**
 * VoltMesh Fleet Web Dashboard JavaScript Engine
 * Specification: VoltMesh Architecture Bible (Page 8, 12, 16)
 * Interactive Leaflet Map & Multi-Hop Relay Trace Renderer
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Leaflet map centered at IIT BHU
  const map = L.map('map').setView([25.2677, 82.9913], 15);

  // Dark theme map tiles!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);;

  // Custom Icon Markers
  const stationIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #10b981;'></div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const sosIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#ef4444; width:20px; height:20px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 14px #ef4444;'></div>",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const riderIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#38bdf8; width:14px; height:14px; border-radius:50%; border:2px solid #fff;'></div>",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  // Plot Swap Stations
  L.marker([25.2680, 82.9920], { icon: stationIcon })
    .addTo(map)
    .bindPopup("<b>Station 901 (BHU Gate)</b><br>Stock: 4 Charged Packs");

  L.marker([25.2650, 82.9880], { icon: stationIcon })
    .addTo(map)
    .bindPopup("<b>Station 902 (Lanka Corner)</b><br>Stock: 2 Charged Packs");

  // Plot Stranded Rider Emergency SOS Marker
  L.marker([25.2677, 82.9913], { icon: sosIcon })
    .addTo(map)
    .bindPopup("<b>🚨 EMERGENCY SOS: Node #4242</b><br>Status: Stranded (Battery 8%)<br>Relay Path: 4242 → 102 → 205 → Station 901");

  // Plot Intermediate Relaying Riders
  L.marker([25.2678, 82.9916], { icon: riderIcon })
    .addTo(map)
    .bindPopup("<b>Relay Rider Node #102</b><br>Transport: BLE (Powering Relay)");

  L.marker([25.2679, 82.9918], { icon: riderIcon })
    .addTo(map)
    .bindPopup("<b>Relay Rider Node #205</b><br>Transport: BLE -> Station 901");

  // Draw Multi-Hop Polyline Path (A -> B -> C -> Station)
  const hopPath = [
    [25.2677, 82.9913], // Node 4242 (Origin)
    [25.2678, 82.9916], // Node 102
    [25.2679, 82.9918], // Node 205
    [25.2680, 82.9920]  // Station 901 (Gateway)
  ];

  L.polyline(hopPath, {
    color: '#ef4444',
    weight: 3,
    dashArray: '6, 6',
    opacity: 0.9
  }).addTo(map);

  console.log('[VoltMesh Fleet Dashboard] Interactive map & multi-hop visualizer initialized.');
});