import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUnloadAsync, mockPlayAsync, mockSetPositionAsync } = vi.hoisted(() => ({
  mockUnloadAsync: vi.fn(),
  mockPlayAsync: vi.fn(),
  mockSetPositionAsync: vi.fn(),
}));

vi.mock("./callout-assets", () => ({
  default: { start: 1, halfway: 2, "time-halfway": 2, finish: 3 },
}));

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: vi.fn(),
    Sound: {
      createAsync: vi.fn().mockResolvedValue({
        sound: {
          playAsync: mockPlayAsync,
          setPositionAsync: mockSetPositionAsync,
          unloadAsync: mockUnloadAsync,
        },
      }),
    },
  },
  InterruptionModeIOS: { DuckOthers: 2 },
  InterruptionModeAndroid: { DuckOthers: 2 },
}));

import { Audio } from "expo-av";
import { playCallout, preloadCallouts, unloadCallouts } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
  unloadCallouts();
  vi.mocked(Audio.Sound.createAsync).mockResolvedValue({
    sound: {
      playAsync: mockPlayAsync,
      setPositionAsync: mockSetPositionAsync,
      unloadAsync: mockUnloadAsync,
    },
  } as never);
});

describe("preloadCallouts", () => {
  it("configures audio session", async () => {
    await preloadCallouts();

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      }),
    );
  });

  it("creates sounds for all events", async () => {
    await preloadCallouts();

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(1);
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(2);
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(3);
  });
});

describe("playCallout", () => {
  it("replays preloaded sound from position 0", async () => {
    await preloadCallouts();
    vi.clearAllMocks();

    await playCallout("start");

    expect(mockSetPositionAsync).toHaveBeenCalledWith(0);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
  });

  it("falls back to creating sound if not preloaded", async () => {
    await playCallout("start");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(1);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });

  it("plays the correct asset for each event", async () => {
    await preloadCallouts();

    await playCallout("time-halfway");
    expect(mockPlayAsync).toHaveBeenCalled();

    await playCallout("finish");
    expect(mockPlayAsync).toHaveBeenCalled();
  });
});

describe("unloadCallouts", () => {
  it("unloads all preloaded sounds", async () => {
    await preloadCallouts();

    await unloadCallouts();

    expect(mockUnloadAsync).toHaveBeenCalled();
  });
});
