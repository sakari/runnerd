# iOS Background Audio Indicators — Research & Implementation Plan

## Problem Statement

When the Runnerd app goes to the background (user locks screen or switches apps during a run),
voice callouts (start, halfway, finish) may fail or fade out. The root cause is that iOS suspends
`AVSpeechSynthesizer` (used by `expo-speech`) when the app is backgrounded, even though
`UIBackgroundModes: ["audio"]` is declared.

The current workaround in `src/platform/speech.ts` plays a **one-shot** silent WAV clip before each
`Speech.speak()` call. This is fragile because:

1. The silent clip finishes and unloads immediately — the audio session goes idle between callouts
2. iOS may reclaim the idle audio session before the next voice trigger fires (could be minutes apart)
3. The `expo-speech` issue [#19407](https://github.com/expo/expo/issues/19407) confirms this problem
   persists on physical devices (works on simulator)

## Current Stack

| Package | Version | Notes |
|---|---|---|
| expo | ~54.0.33 | SDK 54 |
| expo-av | ~16.0.8 | Deprecated (removed in SDK 55) but functional in SDK 54 |
| expo-speech | ~55.0.11 | No `useApplicationAudioSession` option despite [PR #18374](https://github.com/expo/expo/pull/18374) |
| expo-task-manager | 55.0.10 | Installed but unused |

**No new packages required.** All work uses expo-av and expo-speech already in the lockfile.

## How iOS Background Audio Works

**Apple docs:** https://developer.apple.com/documentation/avfaudio/avaudiosession

iOS grants background execution to apps that are **actively playing audio** via `AVAudioSession` with
category `.playback`. The chain of requirements:

1. `UIBackgroundModes` includes `"audio"` in Info.plist → **already configured** in `app.json`
2. `AVAudioSession` category set to `.playback` → **already done** via `ensureAudioSession()` 
   (`playsInSilentModeIOS: true`, `staysActiveInBackground: true`)
3. An `AVAudioPlayer` instance **must be actively playing** — this is the missing piece

When no audio player is active, iOS considers the audio session idle and may suspend
`AVSpeechSynthesizer` even though the session is configured for background playback.

**Reference:** [Apple Developer Forums — AVSpeechSynthesizer in background](https://developer.apple.com/forums/thread/27097)

> "Play a small snippet of plain old sound (with AVAudioPlayer) right after the call to
> speakUtterance(). That keeps the audio session alive."

**Reference:** [How to Add Background Audio to Expo Apps](https://dev.to/josie/how-to-add-background-audio-to-expo-apps-3fgc)

## App Store Review Safety

**Guideline 2.5.4:** Apps must only use background modes for their intended purpose.

Our use case is **legitimate** — the app plays audible voice callouts to the runner while backgrounded,
identical to what Strava, Nike Run Club, and Apple's own Workout app do. We are not abusing the audio
background mode to keep the app alive for non-audio work. The location tracking is separately authorized
via the `location` background mode.

**Reference:** [App Store Review Guidelines 2.5.4](https://developer.apple.com/app-store/review/guidelines/#software-requirements)

Key: the silent audio loop is a **bridge** between legitimate voice callouts — not the purpose of the
background mode itself.

## Recommended Approach: Continuous Silent Audio Loop

### Strategy

Instead of a one-shot silent clip before each `speak()` call, **loop a silent audio file continuously
for the entire duration of a run**. This keeps the `AVAudioSession` active so `AVSpeechSynthesizer`
is never suspended.

```
Run starts → start looping silence → voice callouts fire reliably → run ends → stop loop
```

### Why This Works

- `AVAudioPlayer` playing a looped silent track keeps the audio session in the "actively playing" state
- iOS will not suspend `AVSpeechSynthesizer` while another player on the same session is active
- The `DuckOthers` interruption mode means the user's music/podcasts keep playing (at reduced volume
  only during actual speech)
- Battery impact is negligible — the CPU decoder for a silent PCM file is essentially idle

**Reference:** [iOS — Playing audio in the background](https://www.sagorin.org/ios-playing-audio-in-background-audio/)

### Alternatives Considered

| Approach | Verdict |
|---|---|
| **`useApplicationAudioSession` on expo-speech** | Not available — [PR #18374](https://github.com/expo/expo/pull/18374) was never merged into the types |
| **expo-audio (new API)** | Only stable from SDK 53+. We'd be on SDK 54 where expo-av still works. Migration to expo-audio is a future SDK 55 concern, not needed now |
| **react-native-track-player** | Overkill — designed for music apps with lock-screen controls. Adds a native dependency + config plugin for something expo-av already handles |
| **expo-task-manager background task** | Background tasks run on a separate JS thread with no UI. Playing audio from a background task has additional restrictions and is unreliable for TTS |

## Implementation Plan

### Step 1: Create a persistent silent audio loop module

**File:** `src/platform/silent-loop.ts`

- Load `assets/silence.wav` via `Audio.Sound.createAsync()`
- Set `isLooping: true` and `volume: 0.0` (fully silent but keeps session alive)
- Export `startSilentLoop()` and `stopSilentLoop()` functions
- `startSilentLoop()` calls `ensureAudioSession()` first, then plays the loop
- `stopSilentLoop()` stops and unloads the sound
- Guard against double-start / double-stop

**Key expo-av settings** (all already in `ensureAudioSession()`):
```ts
await Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,           // play even on silent switch
  staysActiveInBackground: true,         // don't deactivate in background
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,  // duck user's music
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
});
```

**Looping config:**
```ts
const { sound } = await Audio.Sound.createAsync(
  silenceAsset,
  { isLooping: true, volume: 0.01 }  // near-silent, looping
);
await sound.playAsync();
```

Note: `volume: 0.01` instead of `0.0` — some iOS versions treat 0.0 as "not really playing"
and may still suspend the session. A near-zero volume on a silent file has zero audible effect.

**Reference:** [expo/expo#18446 — setIsLoopingAsync](https://github.com/expo/expo/issues/18446) (known small gap between loops on iOS — acceptable for our use case since the file is silent)

### Step 2: Simplify `speech.ts`

- Remove the one-shot `activateAudioSession()` function (no longer needed)
- `speak()` just calls `ensureAudioSession()` + `Speech.speak()` directly
- The silent loop already keeps the session alive — no need for a per-call silent clip

### Step 3: Wire into `TimerScreen.tsx`

- In `handleStart()`: call `startSilentLoop()` before `speak(buildCallout("start", ...))`
- In `handleStop()` / `cleanup()`: call `stopSilentLoop()`
- This ensures the loop runs exactly as long as a run is active

### Step 4: Test on physical iOS device

Testing must be done on a **real device** — the simulator does not reproduce the background audio
suspension issue ([expo/expo#19407](https://github.com/expo/expo/issues/19407)).

Test matrix:
- [ ] Start run → lock screen → wait for halfway callout → verify speech plays
- [ ] Start run → switch to another app → wait for halfway callout → verify speech plays
- [ ] Start run → play music → lock screen → verify speech ducks music then music resumes
- [ ] Start run → receive phone call → end call → verify speech resumes
- [ ] Start run → leave running for 10+ minutes locked → verify finish callout plays
- [ ] Verify no audio artifacts (clicks, pops, gaps) from the silent loop
- [ ] Verify battery impact is negligible over a 30-minute run

## Package Version Safety

**No new packages are added.** The implementation uses:

- `expo-av@16.0.8` — already in `pnpm-lock.yaml`, published 2025-12-16 (well over 3 days old)
- `expo-speech@55.0.11` — already in `pnpm-lock.yaml`, published 2025-11-17 (well over 3 days old)
- `assets/silence.wav` — already in the repo (1.6KB)

## Future Migration Path (SDK 55+)

When upgrading to Expo SDK 55, `expo-av` will be removed. At that point:
- Replace `expo-av` silent loop with `expo-audio` equivalent (same concept, new API)
- Check if `expo-speech` gains `useApplicationAudioSession` by then
- The architecture (loop module + speech module + timer wiring) will remain the same

**Reference:** [Clarify doc about Expo AV removal in SDK 54](https://github.com/expo/expo/issues/37259)
