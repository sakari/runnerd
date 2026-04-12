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
  playStartCallout,
  playFinishCallout,
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

describe("playStartCallout", () => {
  it("fires an immediate notification with start sound", async () => {
    await playStartCallout();

    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: "run-start",
      content: expect.objectContaining({ sound: "lets-go.wav" }),
      trigger: null,
    });
  });
});

describe("playFinishCallout", () => {
  it("fires an immediate notification with finish sound", async () => {
    await playFinishCallout();

    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: "run-callout",
      content: expect.objectContaining({ sound: "times_up.wav" }),
      trigger: null,
    });
  });
});

describe("scheduleTimeNotifications", () => {
  it("schedules halfway and finish notifications", async () => {
    await scheduleTimeNotifications(1800);

    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ sound: "halfway.wav" }),
        trigger: expect.objectContaining({ seconds: 900 }),
      }),
    );
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ sound: "times_up.wav" }),
        trigger: expect.objectContaining({ seconds: 1800 }),
      }),
    );
  });
});

describe("cancelTimeNotifications", () => {
  it("cancels scheduled and dismisses all delivered notifications", async () => {
    await cancelTimeNotifications();
    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockDismiss).toHaveBeenCalledWith("run-start");
    expect(mockDismiss).toHaveBeenCalledWith("run-halfway");
    expect(mockDismiss).toHaveBeenCalledWith("run-finish");
    expect(mockDismiss).toHaveBeenCalledWith("run-callout");
  });
});

describe("setupNotificationHandler", () => {
  it("registers a notification handler", () => {
    setupNotificationHandler();
    expect(mockSetHandler).toHaveBeenCalledOnce();
  });

  it("dismisses start notification when halfway fires", async () => {
    setupNotificationHandler();
    const handler = mockSetHandler.mock.calls[0][0];
    await handler.handleNotification({ request: { identifier: "run-halfway" } });
    expect(mockDismiss).toHaveBeenCalledWith("run-start");
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
