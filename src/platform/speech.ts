import * as Speech from "expo-speech";
import { VoiceCallout } from "../core/voice-triggers";
import { ensureAudioSession } from "./audio-session";

export async function speak(callout: VoiceCallout): Promise<void> {
  await ensureAudioSession();
  Speech.speak(callout.text, {
    language: "en-US",
    rate: 0.9,
  });
}
