import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchedule = vi.fn();
const mockCancel = vi.fn();
const mockRequestPermissions = vi.fn();

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => mockCancel(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));

import {
  requestNotificationPermissions,
  scheduleTimeNotifications,
  cancelTimeNotifications,
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
  it("cancels all scheduled notifications", async () => {
    await cancelTimeNotifications();
    expect(mockCancel).toHaveBeenCalledOnce();
  });
});
