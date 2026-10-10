/**
 * VoltMesh RangeCheck & Stranding Prevention Module (JavaScript)
 * Specification: VoltMesh Architecture Bible (Page 3, 10, 16)
 */

export class RangeCheck {
  static KM_PER_PERCENT = 1.2;
  static SAFETY_MARGIN_KM = 3.0;

  static calculateRemainingRange(batteryPercentage, kmPerPercent = RangeCheck.KM_PER_PERCENT) {
    const pct = Math.max(0, Math.min(100, Number(batteryPercentage) || 0));
    return parseFloat((pct * kmPerPercent).toFixed(1));
  }

  static calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
    const R = 6371;
    const dLat = RangeCheck._deg2rad(lat2 - lat1);
    const dLon = RangeCheck._deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(RangeCheck._deg2rad(lat1)) *
        Math.cos(RangeCheck._deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  static evaluateStrandingRisk({
    currentLat,
    currentLon,
    batteryPercentage,
    cachedStations = [],
    kmPerPercent = RangeCheck.KM_PER_PERCENT,
  }) {
    const estimatedRange = RangeCheck.calculateRemainingRange(batteryPercentage, kmPerPercent);

    if (!cachedStations || cachedStations.length === 0) {
      return {
        isStrandingRisk: batteryPercentage <= 15,
        reason: 'NO_CACHED_STATIONS',
        estimatedRange,
        nearestStation: null,
        reachableStations: [],
      };
    }

    let nearestStation = null;
    let minDistance = Infinity;
    const reachableStations = [];

    for (const station of cachedStations) {
      const dist = RangeCheck.calculateDistanceKm(
        currentLat,
        currentLon,
        station.lat,
        station.lon
      );

      const stationWithDist = {
        ...station,
        distanceKm: dist,
        hasStock: station.batteriesAvailable > 0,
      };

      if (dist < minDistance) {
        minDistance = dist;
        nearestStation = stationWithDist;
      }

      if (
        station.batteriesAvailable > 0 &&
        dist <= Math.max(0, estimatedRange - RangeCheck.SAFETY_MARGIN_KM)
      ) {
        reachableStations.push(stationWithDist);
      }
    }

    const isStrandingRisk = reachableStations.length === 0 && batteryPercentage <= 25;

    return {
      isStrandingRisk,
      reason: isStrandingRisk ? 'NO_REACHABLE_STATION_WITH_STOCK' : 'SAFE',
      estimatedRange,
      nearestStation,
      reachableStationsCount: reachableStations.length,
      reachableStations,
    };
  }

  static _deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
}