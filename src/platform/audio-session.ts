import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

let configured = false;

export async function ensureAudioSession(): Promise<void> {
  if (configured) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
  });
  configured = true;
}
