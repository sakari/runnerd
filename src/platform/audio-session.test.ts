import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: vi.fn(),
  },
  InterruptionModeIOS: { DuckOthers: 2 },
  InterruptionModeAndroid: { DuckOthers: 2 },
}));

import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { ensureAudioSession } from "./audio-session";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureAudioSession", () => {
  it("configures audio mode for background playback", async () => {
    await ensureAudioSession();

    expect(Audio.setAudioModeAsync).toHaveBeenCalledOnce();
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
    });
  });
});
