import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUnloadAsync, mockPlayAsync, mockSetOnPlaybackStatusUpdate } = vi.hoisted(() => ({
  mockUnloadAsync: vi.fn(),
  mockPlayAsync: vi.fn(),
  mockSetOnPlaybackStatusUpdate: vi.fn(),
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
          setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
          unloadAsync: mockUnloadAsync,
        },
      }),
    },
  },
  InterruptionModeIOS: { DuckOthers: 2 },
  InterruptionModeAndroid: { DuckOthers: 2 },
}));

import { Audio } from "expo-av";
import { playCallout } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Audio.Sound.createAsync).mockResolvedValue({
    sound: {
      playAsync: mockPlayAsync,
      setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      unloadAsync: mockUnloadAsync,
    },
  } as never);
});

describe("playCallout", () => {
  it("configures audio session before playing", async () => {
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      cb({ didJustFinish: true });
    });

    await playCallout("start");

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      }),
    );
  });

  it("loads and plays the correct asset for the event", async () => {
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      cb({ didJustFinish: true });
    });

    await playCallout("start");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(1);
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });

  it("loads the halfway asset for time-halfway event", async () => {
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      cb({ didJustFinish: true });
    });

    await playCallout("time-halfway");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(2);
  });

  it("loads the finish asset for finish event", async () => {
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      cb({ didJustFinish: true });
    });

    await playCallout("finish");

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(3);
  });

  it("unloads sound after playback finishes", async () => {
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      cb({ didJustFinish: true });
    });

    await playCallout("start");

    expect(mockUnloadAsync).toHaveBeenCalledOnce();
  });

  it("does not resolve while still playing", async () => {
    let statusCb: (s: unknown) => void = () => {};
    mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (s: unknown) => void) => {
      statusCb = cb;
    });

    let resolved = false;
    const p = playCallout("start").then(() => {
      resolved = true;
    });

    // Let playAsync resolve and status callback get registered
    await new Promise((r) => setTimeout(r, 10));

    // Simulate in-progress status
    statusCb({ isPlaying: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
    expect(mockUnloadAsync).not.toHaveBeenCalled();

    // Now finish
    statusCb({ didJustFinish: true });
    await p;
    expect(resolved).toBe(true);
    expect(mockUnloadAsync).toHaveBeenCalledOnce();
  });
});
