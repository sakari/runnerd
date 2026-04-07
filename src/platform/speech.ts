import * as Speech from "expo-speech";
import { VoiceCallout } from "../core/voice-triggers";

export function speak(callout: VoiceCallout): void {
  Speech.speak(callout.text, {
    language: "en-US",
    rate: 0.9,
  });
}
