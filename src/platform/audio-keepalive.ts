import { Audio } from "expo-av";
import { ensureAudioSession } from "./audio-session";
import silentTrack from "./keepalive-asset";

let keepaliveSound: Audio.Sound | null = null;

// Plays a silent looping track so the iOS audio session stays active in the
// background. Without this, JS timers throttle and Speech.speak fades to
// silence once the app is backgrounded.
export async function startAudioKeepalive(): Promise<void> {
  if (keepaliveSound) return;
  await ensureAudioSession();
  const { sound } = await Audio.Sound.createAsync(silentTrack, {
    isLooping: true,
    shouldPlay: true,
    volume: 0,
  });
  keepaliveSound = sound;
}

export async function stopAudioKeepalive(): Promise<void> {
  const sound = keepaliveSound;
  keepaliveSound = null;
  if (!sound) return;
  await sound.stopAsync().catch(() => {});
  await sound.unloadAsync().catch(() => {});
}

export function _resetKeepaliveForTesting(): void {
  keepaliveSound = null;
}
