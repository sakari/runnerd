import * as Location from "expo-location";
import { GeoPoint } from "../core/types";

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  // Also request background for when app is backgrounded
  const bg = await Location.requestBackgroundPermissionsAsync();
  // Foreground-only is still usable, so we don't fail on bg denial
  return true;
}

export type GpsCallback = (point: GeoPoint) => void;

let subscription: Location.LocationSubscription | null = null;

export async function startTracking(onPoint: GpsCallback): Promise<void> {
  if (subscription) return;

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5, // meters — avoid noisy updates
      timeInterval: 3000, // ms
    },
    (loc) => {
      onPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
      });
    },
  );
}

export function stopTracking(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
}
