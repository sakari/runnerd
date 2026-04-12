import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPlayAsync, mockSetPositionAsync } = vi.hoisted(() => ({
  mockPlayAsync: vi.fn(),
  mockSetPositionAsync: vi.fn(),
}));

vi.mock("./callout-assets", () => ({
  default: { start: 1, finish: 3 },
}));

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: vi.fn(),
    Sound: {
      createAsync: vi.fn().mockResolvedValue({
        sound: {
          playAsync: mockPlayAsync,
          setPositionAsync: mockSetPositionAsync,
        },
      }),
    },
  },
  InterruptionModeIOS: { MixWithOthers: 1 },
  InterruptionModeAndroid: { DoNotMix: 0 },
}));

import { Audio } from "expo-av";
import { playCallout, _resetCacheForTesting } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
  _resetCacheForTesting();
});

describe("playCallout", () => {
  it("configures audio session", async () => {
    await playCallout("start");

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playsInSilentModeIOS: true,
      }),
    );
  });

  it("creates and plays the correct asset", async () => {
    await playCallout("start");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(1);
    expect(mockSetPositionAsync).toHaveBeenCalledWith(0);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });

  it("reuses cached sound on second call", async () => {
    await playCallout("start");
    await playCallout("start");

    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
    expect(mockPlayAsync).toHaveBeenCalledTimes(2);
    expect(mockSetPositionAsync).toHaveBeenCalledTimes(2);
  });

  it("plays the correct asset for finish event", async () => {
    await playCallout("finish");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(3);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });
});
