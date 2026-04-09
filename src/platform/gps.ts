import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { GeoPoint } from "../core/types";
import { GpsFilter } from "../core/gps-filter";

const LOCATION_TASK = "background-location";

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  await Location.requestBackgroundPermissionsAsync();
  return true;
}

export type GpsCallback = (point: GeoPoint) => void;

let callback: GpsCallback | null = null;
let filter: GpsFilter | null = null;
let tracking = false;

TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const loc of locations) {
    const raw: GeoPoint = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp,
    };
    const smoothed = filter?.process(raw);
    if (smoothed && callback) {
      callback(smoothed);
    }
  }
});

export async function startTracking(onPoint: GpsCallback): Promise<void> {
  if (tracking) return;
  tracking = true;

  filter = new GpsFilter();
  callback = onPoint;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: 3000,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    pausesLocationUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "Runnerd",
      notificationBody: "Tracking your run",
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (!tracking) return;
  tracking = false;
  callback = null;

  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Task may not have been registered yet
  }

  if (filter) {
    filter.reset();
    filter = null;
  }
}
