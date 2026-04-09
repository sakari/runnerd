import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

let active = false;

export async function ensureAudioSession(): Promise<void> {
  if (active) return;
  active = true;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
  });
}

export function releaseAudioSession(): void {
  active = false;
}
