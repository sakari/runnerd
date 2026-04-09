import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

let initialized = false;

export async function ensureAudioSession(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
  });
}
