import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchedule = vi.fn();
const mockCancel = vi.fn();
const mockDismiss = vi.fn();
const mockRequestPermissions = vi.fn();
const mockSetHandler = vi.fn();

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => mockCancel(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismiss(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetHandler(...args),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));

import {
  requestNotificationPermissions,
  scheduleTimeNotifications,
  cancelTimeNotifications,
  setupNotificationHandler,
} from "./time-notifications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestNotificationPermissions", () => {
  it("returns true when granted", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "granted" });
    expect(await requestNotificationPermissions()).toBe(true);
  });

  it("returns false when denied", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "denied" });
    expect(await requestNotificationPermissions()).toBe(false);
  });
});

describe("scheduleTimeNotifications", () => {
  it("schedules halfway and finish notifications without sound (visual fallback)", async () => {
    await scheduleTimeNotifications(1800);

    expect(mockSchedule).toHaveBeenCalledTimes(2);
    const calls = mockSchedule.mock.calls.map((c) => c[0]);
    const halfway = calls.find((c) => c.identifier === "run-halfway");
    const finish = calls.find((c) => c.identifier === "run-finish");

    expect(halfway.trigger.seconds).toBe(900);
    expect(halfway.content.sound).toBeUndefined();
    expect(finish.trigger.seconds).toBe(1800);
    expect(finish.content.sound).toBeUndefined();
  });
});

describe("cancelTimeNotifications", () => {
  it("cancels scheduled and dismisses delivered notifications", async () => {
    await cancelTimeNotifications();
    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockDismiss).toHaveBeenCalledWith("run-halfway");
    expect(mockDismiss).toHaveBeenCalledWith("run-finish");
  });
});

describe("setupNotificationHandler", () => {
  it("registers a notification handler", () => {
    setupNotificationHandler();
    expect(mockSetHandler).toHaveBeenCalledOnce();
  });

  it("dismisses halfway notification when finish fires", async () => {
    setupNotificationHandler();
    const handler = mockSetHandler.mock.calls[0][0];
    const result = await handler.handleNotification({
      request: { identifier: "run-finish" },
    });
    expect(mockDismiss).toHaveBeenCalledWith("run-halfway");
    expect(result).toEqual({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false });
  });
});
