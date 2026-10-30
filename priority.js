// Priority Score (0-100): dangerous issues rank higher.
const BASE = {
  open_manhole: 90,
  exposed_wire: 95,
  water_leakage: 60,
  pothole: 55,
  broken_streetlight: 50,
  garbage: 40,
  other: 25,
};

export function priorityScore({ category, severity = 3, duplicateCount = 0 }) {
  const base = BASE[category] ?? BASE.other;
  const sev = Math.min(5, Math.max(1, Number(severity) || 3));
  const sevBoost = (sev - 3) * 5; // -10 .. +10
  const crowdBoost = Math.min(15, duplicateCount * 3); // repeated reports raise urgency
  return Math.max(0, Math.min(100, Math.round(base + sevBoost + crowdBoost)));
}

export function priorityLabel(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// Haversine distance in metres
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
