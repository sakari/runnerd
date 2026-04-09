import * as Location from "expo-location";
import { GeoPoint } from "../core/types";
import { GpsFilter } from "../core/gps-filter";

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  await Location.requestBackgroundPermissionsAsync();
  return true;
}

export type GpsCallback = (point: GeoPoint) => void;

let subscription: Location.LocationSubscription | null = null;
let filter: GpsFilter | null = null;

export async function startTracking(onPoint: GpsCallback): Promise<void> {
  if (subscription) return;

  filter = new GpsFilter();

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 3000,
    },
    (loc) => {
      const raw: GeoPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
      };
      const smoothed = filter!.process(raw);
      if (smoothed) {
        onPoint(smoothed);
      }
    },
  );
}

export function stopTracking(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  if (filter) {
    filter.reset();
    filter = null;
  }
}
