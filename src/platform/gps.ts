import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { GeoPoint } from "../core/types";
import { GpsFilter } from "../core/gps-filter";

const BACKGROUND_LOCATION_TASK = "background-location-task";

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return bgStatus === "granted";
}

export type GpsCallback = (point: GeoPoint) => void;

let filter: GpsFilter | null = null;
let foregroundSub: Location.LocationSubscription | null = null;
let activeCallback: GpsCallback | null = null;

// Register the background task at module level (required by expo-task-manager)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!activeCallback || !filter) return;

  for (const loc of locations) {
    const raw: GeoPoint = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp,
    };
    const smoothed = filter.process(raw);
    if (smoothed) {
      activeCallback(smoothed);
    }
  }
});

export async function startTracking(onPoint: GpsCallback): Promise<void> {
  if (activeCallback) return;

  filter = new GpsFilter();
  activeCallback = onPoint;

  // Start foreground tracking for responsive UI updates
  foregroundSub = await Location.watchPositionAsync(
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

  // Start background location tracking
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Runnerd",
      notificationBody: "Tracking your run",
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (foregroundSub) {
    foregroundSub.remove();
    foregroundSub = null;
  }

  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  activeCallback = null;
  if (filter) {
    filter.reset();
    filter = null;
  }
}
