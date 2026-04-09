import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRemove } = vi.hoisted(() => ({
  mockRemove: vi.fn(),
}));

vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestBackgroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  watchPositionAsync: vi.fn().mockResolvedValue({ remove: mockRemove }),
  Accuracy: { High: 5 },
}));

import * as Location from "expo-location";
import { requestPermissions, startTracking, stopTracking } from "./gps";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level subscription state by stopping any active tracking
  stopTracking();
  mockRemove.mockClear();
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
  it("starts watching position with high accuracy", async () => {
    const callback = vi.fn();

    await startTracking(callback);

    expect(Location.watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        timeInterval: 3000,
      }),
      expect.any(Function),
    );
  });

  it("passes GPS points through the Kalman filter to callback", async () => {
    const callback = vi.fn();

    await startTracking(callback);

    // Get the location callback that was passed to watchPositionAsync
    const locationCallback = vi.mocked(Location.watchPositionAsync).mock.calls[0][1];

    // Simulate a location update — first point initializes filter, second produces output
    locationCallback({
      coords: { latitude: 60.17, longitude: 24.94 },
      timestamp: 1000,
    } as Location.LocationObject);

    locationCallback({
      coords: { latitude: 60.1701, longitude: 24.9401 },
      timestamp: 4000,
    } as Location.LocationObject);

    // The filter may suppress the first point (initialization) but should emit after that
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

    expect(Location.watchPositionAsync).toHaveBeenCalledOnce();
  });
});

describe("stopTracking", () => {
  it("removes the location subscription", async () => {
    await startTracking(vi.fn());

    stopTracking();

    expect(mockRemove).toHaveBeenCalledOnce();
  });

  it("does nothing if not tracking", () => {
    stopTracking();

    expect(mockRemove).not.toHaveBeenCalled();
  });
});
