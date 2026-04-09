import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { VoiceCallout } from "../core/voice-triggers";
import { ensureAudioSession } from "./audio-session";
import silenceAsset from "./silence-asset";

// Play a silent clip via expo-av to wake up the iOS audio session.
// AVSpeechSynthesizer (expo-speech) gets suspended on lock screen,
// but an active AVAudioPlayer session keeps it alive.
async function activateAudioSession(): Promise<void> {
  try {
    const { sound } = await Audio.Sound.createAsync(silenceAsset);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // Best-effort — speech may still work without this
  }
}

export async function speak(callout: VoiceCallout): Promise<void> {
  await ensureAudioSession();
  await activateAudioSession();
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
