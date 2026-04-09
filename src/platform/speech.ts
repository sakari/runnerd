import { Audio } from "expo-av";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession } from "./audio-session";
import calloutAssets from "./callout-assets";

export async function playCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  const { sound } = await Audio.Sound.createAsync(calloutAssets[event]);
  await sound.playAsync();
  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        sound.unloadAsync();
        resolve();
      }
    });
  });
}
