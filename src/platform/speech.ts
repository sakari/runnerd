import { Audio } from "expo-av";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession } from "./audio-session";
import calloutAssets from "./callout-assets";

export async function playCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  const { sound } = await Audio.Sound.createAsync(calloutAssets[event]);
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
    }
  });
  await sound.playAsync();
}
