import { Audio } from "expo-av";
import { VoiceEvent } from "../core/types";
import { ensureAudioSession } from "./audio-session";
import calloutAssets from "./callout-assets";

const loaded: Partial<Record<VoiceEvent, Audio.Sound>> = {};

export async function preloadCallouts(): Promise<void> {
  await ensureAudioSession();
  const events = Object.keys(calloutAssets) as VoiceEvent[];
  for (const event of events) {
    if (!loaded[event]) {
      const { sound } = await Audio.Sound.createAsync(calloutAssets[event]);
      loaded[event] = sound;
    }
  }
}

export async function unloadCallouts(): Promise<void> {
  for (const event of Object.keys(loaded) as VoiceEvent[]) {
    const sound = loaded[event];
    if (sound) {
      await sound.unloadAsync();
      delete loaded[event];
    }
  }
}

export async function playCallout(event: VoiceEvent): Promise<void> {
  await ensureAudioSession();
  const sound = loaded[event];
  if (sound) {
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } else {
    const { sound: s } = await Audio.Sound.createAsync(calloutAssets[event]);
    await s.playAsync();
  }
}
