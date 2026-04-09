import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDefineTask, taskCb } = vi.hoisted(() => ({
  mockDefineTask: vi.fn(),
  taskCb: { current: (_body: { data: unknown; error: unknown }) => {} },
}));

vi.mock("expo-task-manager", () => ({
  defineTask: (name: string, cb: (body: { data: unknown; error: unknown }) => void) => {
    mockDefineTask(name, cb);
    taskCb.current = cb;
  },
}));

vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestBackgroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  startLocationUpdatesAsync: vi.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: vi.fn().mockResolvedValue(undefined),
  Accuracy: { High: 5 },
  ActivityType: { Fitness: 3 },
}));

import * as Location from "expo-location";
import { requestPermissions, startTracking, stopTracking } from "./gps";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level tracking state
  stopTracking();
});

describe("requestPermissions", () => {
  it("returns true when foreground permission is granted", async () => {
    const result = await requestPermissions();

    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledOnce();
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledOnce();
  });

  it("returns false when foreground permission is denied", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      status: "denied" as Location.PermissionStatus,
      granted: false,
      canAskAgain: true,
      expires: "never",
    });

    const result = await requestPermissions();

    expect(result).toBe(false);
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("startTracking", () => {
  it("starts background location updates with fitness activity type", async () => {
    const callback = vi.fn();

    await startTracking(callback);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      "background-location",
      expect.objectContaining({
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 3000,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
        pausesLocationUpdatesAutomatically: false,
      }),
    );
  });

  it("passes GPS points through the Kalman filter to callback", async () => {
    const callback = vi.fn();

    await startTracking(callback);

    // Simulate background task delivering locations
    taskCb.current({
      data: {
        locations: [{ coords: { latitude: 60.17, longitude: 24.94 }, timestamp: 1000 }],
      },
      error: null,
    });

    taskCb.current({
      data: {
        locations: [{ coords: { latitude: 60.1701, longitude: 24.9401 }, timestamp: 4000 }],
      },
      error: null,
    });

    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    const point = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(point).toHaveProperty("latitude");
    expect(point).toHaveProperty("longitude");
    expect(point).toHaveProperty("timestamp");
  });

  it("does not start a second subscription if already tracking", async () => {
    const callback = vi.fn();

    await startTracking(callback);
    await startTracking(callback);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledOnce();
  });

  it("ignores task callbacks with errors", async () => {
    const callback = vi.fn();

    await startTracking(callback);

    taskCb.current({ data: null, error: new Error("GPS error") });

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("stopTracking", () => {
  it("stops location updates", async () => {
    await startTracking(vi.fn());

    await stopTracking();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith("background-location");
  });

  it("does nothing if not tracking", async () => {
    await stopTracking();

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("stops delivering points after stopping", async () => {
    const callback = vi.fn();
    await startTracking(callback);
    await stopTracking();

    taskCb.current({
      data: {
        locations: [{ coords: { latitude: 60.17, longitude: 24.94 }, timestamp: 1000 }],
      },
      error: null,
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
