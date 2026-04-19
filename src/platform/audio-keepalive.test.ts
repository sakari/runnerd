import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAsync, mockStopAsync, mockUnloadAsync, mockSetAudioModeAsync } = vi.hoisted(
  () => ({
    mockCreateAsync: vi.fn(),
    mockStopAsync: vi.fn().mockResolvedValue(undefined),
    mockUnloadAsync: vi.fn().mockResolvedValue(undefined),
    mockSetAudioModeAsync: vi.fn(),
  }),
);

vi.mock("./keepalive-asset", () => ({ default: 42 }));

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: mockSetAudioModeAsync,
    Sound: {
      createAsync: mockCreateAsync,
    },
  },
  InterruptionModeIOS: { MixWithOthers: 1 },
  InterruptionModeAndroid: { DoNotMix: 0 },
}));

import {
  startAudioKeepalive,
  stopAudioKeepalive,
  _resetKeepaliveForTesting,
} from "./audio-keepalive";

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateAsync.mockResolvedValue({
    sound: { stopAsync: mockStopAsync, unloadAsync: mockUnloadAsync },
  });
  _resetKeepaliveForTesting();
});

describe("audio keepalive", () => {
  it("starts a looping silent sound with zero volume", async () => {
    await startAudioKeepalive();

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ staysActiveInBackground: true }),
    );
    expect(mockCreateAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isLooping: true, shouldPlay: true, volume: 0 }),
    );
  });

  it("does not create a second sound if already started", async () => {
    await startAudioKeepalive();
    await startAudioKeepalive();

    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
  });

  it("stops and unloads on stop", async () => {
    await startAudioKeepalive();
    await stopAudioKeepalive();

    expect(mockStopAsync).toHaveBeenCalledOnce();
    expect(mockUnloadAsync).toHaveBeenCalledOnce();
  });

  it("is a no-op to stop when not started", async () => {
    await stopAudioKeepalive();

    expect(mockStopAsync).not.toHaveBeenCalled();
  });
});
