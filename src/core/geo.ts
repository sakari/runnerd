import { GeoPoint } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two points in meters. */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Total distance along a path of points in meters. */
export function totalDistance(points: GeoPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1], points[i]);
  }
  return d;
}

/** Average speed in m/s. Returns 0 if duration is 0. */
export function avgSpeed(distanceMeters: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return distanceMeters / durationSeconds;
}

/** Pace in minutes per kilometer. Returns 0 if distance is 0. */
export function paceMinPerKm(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0) return 0;
  return durationSeconds / 60 / (distanceMeters / 1000);
}

/** Format seconds as "MM:SS" or "H:MM:SS". */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Format distance for display. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Format pace for display (e.g. "5:30 /km"). */
export function formatPace(distanceMeters: number, durationSeconds: number): string {
  const pace = paceMinPerKm(distanceMeters, durationSeconds);
  if (pace <= 0) return "--:-- /km";
  let mins = Math.floor(pace);
  let secs = Math.round((pace - mins) * 60);
  if (secs === 60) {
    mins += 1;
    secs = 0;
  }
  return `${mins}:${String(secs).padStart(2, "0")} /km`;
}
