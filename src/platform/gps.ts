import * as Location from "expo-location";
import { GeoPoint } from "../core/types";

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  await Location.requestBackgroundPermissionsAsync();
  return true;
}

export type GpsCallback = (point: GeoPoint) => void;

let subscription: Location.LocationSubscription | null = null;

export async function startTracking(onPoint: GpsCallback): Promise<void> {
  if (subscription) return;

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 0,
      timeInterval: 3000,
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
