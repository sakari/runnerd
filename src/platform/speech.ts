import * as Speech from "expo-speech";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession } from "./audio-session";

const PHRASES: Record<VoiceEvent, string> = {
  start: "Let's go",
  halfway: "You're halfway there",
  finish: "Time's up",
};

export async function speakCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  Speech.speak(PHRASES[event], { rate: 1.0, pitch: 1.0 });
}
