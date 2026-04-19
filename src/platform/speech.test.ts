import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSpeak, mockSetAudioModeAsync } = vi.hoisted(() => ({
  mockSpeak: vi.fn(),
  mockSetAudioModeAsync: vi.fn(),
}));

vi.mock("expo-speech", () => ({
  speak: mockSpeak,
}));

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: mockSetAudioModeAsync,
  },
  InterruptionModeIOS: { MixWithOthers: 1 },
  InterruptionModeAndroid: { DoNotMix: 0 },
}));

import { speakCallout } from "./speech";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("speakCallout", () => {
  it("configures audio session before speaking", async () => {
    await speakCallout("start");

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentModeIOS: true }),
    );
  });

  it("speaks the start phrase", async () => {
    await speakCallout("start");

    expect(mockSpeak).toHaveBeenCalledWith("Let's go", expect.any(Object));
  });

  it("speaks the halfway phrase", async () => {
    await speakCallout("halfway");

    expect(mockSpeak).toHaveBeenCalledWith("You're halfway there", expect.any(Object));
  });

  it("speaks the finish phrase", async () => {
    await speakCallout("finish");

    expect(mockSpeak).toHaveBeenCalledWith("Time's up", expect.any(Object));
  });
});
