import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUnloadAsync, mockPlayAsync, mockSetOnPlaybackStatusUpdate } = vi.hoisted(() => ({
  mockUnloadAsync: vi.fn().mockResolvedValue(undefined),
  mockPlayAsync: vi.fn(),
  mockSetOnPlaybackStatusUpdate: vi.fn(),
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
          unloadAsync: mockUnloadAsync,
          setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
        },
      }),
    },
  },
  InterruptionModeIOS: { MixWithOthers: 1 },
  InterruptionModeAndroid: { DoNotMix: 0 },
}));

import { Audio } from "expo-av";
import { playCallout } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Audio.Sound.createAsync).mockResolvedValue({
    sound: {
      playAsync: mockPlayAsync,
      unloadAsync: mockUnloadAsync,
      setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
    },
  } as never);
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
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });

  it("unloads sound when playback finishes", async () => {
    await playCallout("start");

    expect(mockSetOnPlaybackStatusUpdate).toHaveBeenCalledOnce();

    const callback = mockSetOnPlaybackStatusUpdate.mock.calls[0][0];
    // Should not unload while still playing
    callback({ isLoaded: true, didJustFinish: false });
    expect(mockUnloadAsync).not.toHaveBeenCalled();

    // Should unload when finished
    callback({ isLoaded: true, didJustFinish: true });
    expect(mockUnloadAsync).toHaveBeenCalledOnce();
  });

  it("plays the correct asset for finish event", async () => {
    await playCallout("finish");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(3);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });
});
