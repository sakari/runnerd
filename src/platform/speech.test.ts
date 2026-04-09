import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VoiceCallout } from "../core/voice-triggers";

const { mockUnloadAsync, mockPlayAsync, mockSetOnPlaybackStatusUpdate } = vi.hoisted(() => ({
  mockUnloadAsync: vi.fn(),
  mockPlayAsync: vi.fn(),
  mockSetOnPlaybackStatusUpdate: vi.fn(),
}));

// Stub the binary asset (Metro returns a numeric ID at runtime)
vi.mock("./silence-asset", () => ({ default: 1 }));

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

vi.mock("expo-speech", () => ({
  stop: vi.fn(),
  speak: vi.fn(),
}));

import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { speak } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset createAsync to return fresh mock sound each time
  vi.mocked(Audio.Sound.createAsync).mockResolvedValue({
    sound: {
      playAsync: mockPlayAsync,
      setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      unloadAsync: mockUnloadAsync,
    },
  } as never);
  // Default: Speech.speak calls onDone immediately
  vi.mocked(Speech.speak).mockImplementation((_text, options) => {
    options?.onDone?.();
  });
});

const callout: VoiceCallout = { event: "start", text: "Run started. Let's go!" };

describe("speak", () => {
  it("configures audio session before speaking", async () => {
    await speak(callout);

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      }),
    );
  });

  it("plays silent clip to activate iOS audio session", async () => {
    await speak(callout);

    expect(Audio.Sound.createAsync).toHaveBeenCalledOnce();
    expect(mockPlayAsync).toHaveBeenCalledOnce();
  });

  it("unloads silent clip after playback finishes", async () => {
    await speak(callout);

    const statusCallback = mockSetOnPlaybackStatusUpdate.mock.calls[0][0];
    expect(statusCallback).toBeTypeOf("function");

    // Simulate playback finishing
    statusCallback({ didJustFinish: true });
    expect(mockUnloadAsync).toHaveBeenCalledOnce();
  });

  it("does not unload silent clip while still playing", async () => {
    await speak(callout);

    const statusCallback = mockSetOnPlaybackStatusUpdate.mock.calls[0][0];
    statusCallback({ isPlaying: true });
    expect(mockUnloadAsync).not.toHaveBeenCalled();
  });

  it("stops any previous speech before speaking", async () => {
    await speak(callout);

    expect(Speech.stop).toHaveBeenCalledOnce();
    // stop must be called before speak
    const stopOrder = vi.mocked(Speech.stop).mock.invocationCallOrder[0];
    const speakOrder = vi.mocked(Speech.speak).mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(speakOrder);
  });

  it("calls Speech.speak with correct text and options", async () => {
    await speak(callout);

    expect(Speech.speak).toHaveBeenCalledWith("Run started. Let's go!", {
      language: "en-US",
      rate: 0.9,
      onDone: expect.any(Function),
      onError: expect.any(Function),
      onStopped: expect.any(Function),
    });
  });

  it("resolves when speech completes via onDone", async () => {
    vi.mocked(Speech.speak).mockImplementation((_text, options) => {
      options?.onDone?.();
    });

    await expect(speak(callout)).resolves.toBeUndefined();
  });

  it("resolves when speech errors via onError", async () => {
    vi.mocked(Speech.speak).mockImplementation((_text, options) => {
      (options?.onError as () => void)?.();
    });

    await expect(speak(callout)).resolves.toBeUndefined();
  });

  it("resolves when speech is stopped via onStopped", async () => {
    vi.mocked(Speech.speak).mockImplementation((_text, options) => {
      options?.onStopped?.();
    });

    await expect(speak(callout)).resolves.toBeUndefined();
  });

  it("still speaks even if silent clip fails to load", async () => {
    vi.mocked(Audio.Sound.createAsync).mockRejectedValueOnce(new Error("no audio"));

    await speak(callout);

    expect(Speech.speak).toHaveBeenCalledOnce();
  });
});
