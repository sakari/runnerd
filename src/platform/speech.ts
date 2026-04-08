import * as Speech from "expo-speech";
import { VoiceCallout } from "../core/voice-triggers";
import { ensureAudioSession } from "./audio-session";

export async function speak(callout: VoiceCallout): Promise<void> {
  await ensureAudioSession();
  // Stop any in-progress speech before starting new one
  await Speech.stop();
  return new Promise<void>((resolve) => {
    Speech.speak(callout.text, {
      language: "en-US",
      rate: 0.9,
      onDone: resolve,
      onError: () => resolve(),
      onStopped: () => resolve(),
    });
  });
}
