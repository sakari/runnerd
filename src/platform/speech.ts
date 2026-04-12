import { Audio } from "expo-av";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession } from "./audio-session";
import calloutAssets from "./callout-assets";

const cache: Partial<Record<VoiceEvent, Audio.Sound>> = {};

export async function playCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  let sound = cache[event];
  if (!sound) {
    const result = await Audio.Sound.createAsync(calloutAssets[event]);
    sound = result.sound;
    cache[event] = sound;
  }
  await sound.setPositionAsync(0);
  await sound.playAsync();
}

export function _resetCacheForTesting(): void {
  for (const key of Object.keys(cache) as VoiceEvent[]) {
    delete cache[key];
  }
}
