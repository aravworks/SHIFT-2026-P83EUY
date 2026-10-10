const R_KM = 6371.0088; // mean Earth radius

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

/**
 * RangeCheck (docs/architecture.md): usable range = SoC% x km-per-% x (1 - safety margin).
 * A heuristic, not a measurement; it is only as good as the per-vehicle profile.
 */
export function usableRangeKm(socPct: number, kmPerPct: number, safetyMargin: number): number {
  return socPct * kmPerPct * (1 - safetyMargin);
}
