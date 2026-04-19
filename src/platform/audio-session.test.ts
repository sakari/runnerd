import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: vi.fn(),
  },
  InterruptionModeIOS: { MixWithOthers: 1 },
  InterruptionModeAndroid: { DoNotMix: 0 },
}));

import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { ensureAudioSession } from "./audio-session";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureAudioSession", () => {
  it("configures audio mode to stay active in background", async () => {
    await ensureAudioSession();

    expect(Audio.setAudioModeAsync).toHaveBeenCalledOnce();
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
    });
  });
});
