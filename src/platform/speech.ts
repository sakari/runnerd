import { Audio } from "expo-av";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession, deactivateAudioSession } from "./audio-session";
import calloutAssets from "./callout-assets";

export async function playCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  const { sound } = await Audio.Sound.createAsync(calloutAssets[event]);
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync().then(() => deactivateAudioSession());
    }
  });
  await sound.playAsync();
}
