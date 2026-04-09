# E2E Testing: iOS Background Location & Audio

Research into end-to-end testing strategies for runnerd's background location
tracking and voice callout (TTS) features on iOS.

## What Needs Testing

Runnerd relies on two iOS background modes (`UIBackgroundModes: ["location", "audio"]`):

1. **Background location** -- `expo-location` with `watchPositionAsync` continues
   delivering GPS points while the app is backgrounded or the phone is locked.
2. **Background audio / TTS** -- `expo-speech` (AVSpeechSynthesizer) stays alive
   via a silent `expo-av` audio session trick (`staysActiveInBackground: true`,
   `playsInSilentModeIOS: true`) so voice callouts fire on the lock screen.

The key scenarios to verify:

| # | Scenario | What to assert |
|---|----------|----------------|
| 1 | Start run, background app, walk simulated route | Distance accumulates; GPS callback fires |
| 2 | Start run, lock screen, hit distance milestone | TTS callout plays (audio session active) |
| 3 | Background app for 5+ min, foreground again | Timer & distance are correct, no gaps |
| 4 | Start run with "Always" location permission | Background tracking works |
| 5 | Start run with only foreground permission | Tracking stops/degrades in background |

---

## Framework Comparison

### Detox (recommended for runnerd)

Gray-box framework by Wix, designed specifically for React Native.

**Pros:**
- Built-in `device.sendToHome()` to background the app
- Built-in `device.setLocation(lat, lng)` to mock GPS (wraps `xcrun simctl location`)
- `device.launchApp({ newInstance: false })` to foreground from background
- Direct synchronization with React Native bridge -- waits for JS idle
- Works with Expo development builds (requires prebuild / EAS Build)
- JavaScript/TypeScript test authoring -- matches the codebase

**Cons:**
- Requires a native build (not Expo Go)
- Cannot interact with system UI (permission dialogs need `launchApp` permissions config)
- `setLocation` only sets a point; no built-in GPX route playback (but you can loop)

**Background + location test example:**

```typescript
// e2e/backgroundLocation.test.ts
import { device, element, by, expect } from "detox";

describe("Background location tracking", () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: {
        location: "always",
      },
    });
  });

  it("accumulates distance while backgrounded", async () => {
    // Start a run
    await element(by.id("start-button")).tap();

    // Set initial location (e.g. Central Park south entrance)
    await device.setLocation(40.7644, -73.9735);
    await new Promise((r) => setTimeout(r, 4000)); // let GPS callback fire

    // Background the app
    await device.sendToHome();

    // Simulate walking north through Central Park (~500m)
    const route = [
      [40.7654, -73.9732],
      [40.7664, -73.9729],
      [40.7674, -73.9726],
      [40.7684, -73.9723],
      [40.7694, -73.972],
    ];
    for (const [lat, lng] of route) {
      await device.setLocation(lat, lng);
      await new Promise((r) => setTimeout(r, 3000));
    }

    // Bring app back to foreground
    await device.launchApp({ newInstance: false });

    // Assert distance increased
    const distanceEl = element(by.id("distance-display"));
    // Distance should be > 0.3 km (after Kalman filtering)
    await expect(distanceEl).not.toHaveText("0.00");
  });
});
```

### Maestro

Black-box framework with YAML-based tests. Simpler setup, but less control.

**Pros:**
- `setLocation:` command mocks GPS coordinates
- `pressKey: Home` backgrounds the app
- `launchApp:` with `stopApp: false` foregrounds from background
- Zero-code YAML syntax, very fast to write
- Built-in retry/wait logic, low flakiness

**Cons:**
- Black-box only -- cannot observe internal state (distance accumulation)
- Cannot verify audio playback programmatically
- iOS support is simulator-only (physical device support is new/limited)
- No native assertion on React state -- must rely on visible UI text

**Background location test example:**

```yaml
# e2e/background-location.yaml
appId: com.runnerd.app

- launchApp

# Grant location permission (first launch)
- tapOn: "Allow While Using App"
- tapOn: "Change to Always Allow"

# Start a run
- tapOn:
    id: "start-button"

# Set starting location
- setLocation:
    latitude: 40.7644
    longitude: -73.9735
- waitForAnimationToEnd

# Background the app
- pressKey: Home
- wait: 3000

# Simulate movement (5 points, ~500m north)
- setLocation:
    latitude: 40.7664
    longitude: -73.9729
- wait: 3000
- setLocation:
    latitude: 40.7684
    longitude: -73.9723
- wait: 3000
- setLocation:
    latitude: 40.7694
    longitude: -73.9720
- wait: 3000

# Foreground the app
- launchApp:
    stopApp: false

# Assert distance is visible and non-zero
- assertVisible:
    id: "distance-display"
- assertNotEqual:
    id: "distance-display"
    text: "0.00"
```

### Appium

General-purpose mobile automation (black-box).

**Pros:**
- `driver.background(seconds)` puts app in background for N seconds
- `driver.setGeoLocation({ latitude, longitude, altitude })` mocks GPS
- Works with any app (not React Native specific)
- Large ecosystem, CI integrations

**Cons:**
- Slowest of the three (WebDriver protocol overhead)
- More complex setup (Appium server, capabilities config)
- Higher flakiness without careful waits
- No built-in React Native synchronization

Not recommended for runnerd given the simpler alternatives above.

---

## iOS Simulator vs Real Device

| Capability | Simulator | Real device |
|------------|-----------|-------------|
| Background location (UIBackgroundModes) | Yes | Yes |
| `xcrun simctl location set` | Yes | No (use Xcode scheme) |
| Background audio session | Yes | Yes |
| AVSpeechSynthesizer on lock screen | Partial -- no lock screen | Yes |
| Background App Refresh triggering | No | Yes |
| GPS accuracy/realism | Synthetic only | Real GPS + mock via GPX |
| expo-background-task | **No** (not supported on sim) | Yes |

**Key takeaway:** The iOS simulator supports background location and audio session
testing well enough for the core scenarios. Real-device testing is needed to verify
the lock-screen TTS hack (silence.wav + AVSpeechSynthesizer) works end-to-end.

---

## Location Simulation Strategies

### 1. `xcrun simctl location` (direct, works with all frameworks)

```bash
# Set a single point
xcrun simctl location booted set 40.7644,-73.9735

# Clear mock location
xcrun simctl location booted clear
```

### 2. GPX route files (realistic movement)

Create a `.gpx` file with waypoints for a running route:

```xml
<?xml version="1.0"?>
<gpx version="1.1" creator="runnerd-test">
  <wpt lat="40.7644" lon="-73.9735"><name>Start</name></wpt>
  <wpt lat="40.7654" lon="-73.9732"><name>100m</name></wpt>
  <wpt lat="40.7664" lon="-73.9729"><name>200m</name></wpt>
  <wpt lat="40.7674" lon="-73.9726"><name>300m</name></wpt>
  <wpt lat="40.7684" lon="-73.9723"><name>400m</name></wpt>
  <wpt lat="40.7694" lon="-73.9720"><name>500m</name></wpt>
</gpx>
```

Feed points to the simulator with a script:

```bash
#!/bin/bash
# play-route.sh -- feed GPX waypoints to simulator at 1 point/sec
while IFS= read -r line; do
  lat=$(echo "$line" | grep -oP 'lat="\K[^"]+')
  lon=$(echo "$line" | grep -oP 'lon="\K[^"]+')
  if [ -n "$lat" ] && [ -n "$lon" ]; then
    xcrun simctl location booted set "$lat,$lon"
    sleep 3
  fi
done < "$1"
```

### 3. Detox `setLocation` loop (in-test, most controllable)

```typescript
async function simulateRoute(points: [number, number][], intervalMs = 3000) {
  for (const [lat, lng] of points) {
    await device.setLocation(lat, lng);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
```

---

## Audio / TTS Verification

Testing audio output in E2E tests is inherently difficult -- no framework can
"listen" to the speaker. Strategies:

### 1. UI indicator approach (recommended)

Add a test-only visual indicator when speech fires:

```typescript
// In speech.ts, emit an event or set a ref that the UI can display in __DEV__
if (__DEV__) {
  globalThis.__lastSpeechCallout = callout.label;
}
```

Then in Detox:

```typescript
// Assert the callout fired by checking a dev-only text element
await expect(element(by.id("debug-speech-label"))).toHaveText("halfway");
```

### 2. Mock at the native boundary

In the Detox build, replace `expo-speech` with a mock that logs calls to a
file or in-memory store, then assert against that store.

### 3. Verify audio session state (real device)

On a real device, manually verify:
- Start a run, lock the phone, wait for a milestone
- Confirm voice callout is audible through the speaker/headphones
- Confirm the silence.wav trick keeps AVSpeechSynthesizer active

This is a manual acceptance test, not automatable, but critical for the
lock-screen scenario.

---

## Recommended Setup for Runnerd

### Phase 1: Detox with Expo dev build (automated)

1. **Add Detox dependencies:**
   ```bash
   pnpm add -D detox @config-plugins/detox jest
   ```

2. **Add EAS build profile** for simulator testing in `eas.json`:
   ```json
   {
     "build": {
       "e2e-simulator": {
         "developmentClient": true,
         "distribution": "internal",
         "ios": {
           "simulator": true,
           "resourceClass": "m-medium"
         }
       }
     }
   }
   ```

3. **Create `.detoxrc.js`:**
   ```js
   module.exports = {
     testRunner: {
       args: { $0: "jest", config: "e2e/jest.config.js" },
       jest: { setupTimeout: 120000 },
     },
     apps: {
       "ios.release": {
         type: "ios.app",
         binaryPath: "bin/runnerd.app",
       },
     },
     devices: {
       simulator: {
         type: "ios.simulator",
         device: { type: "iPhone 16" },
       },
     },
     configurations: {
       "ios.sim.release": {
         device: "simulator",
         app: "ios.release",
       },
     },
   };
   ```

4. **Add `testID` props** to key UI elements:
   - Start/stop button: `testID="start-button"`
   - Distance display: `testID="distance-display"`
   - Timer display: `testID="timer-display"`
   - Pace display: `testID="pace-display"`

5. **Build and test on your Mac:**
   ```bash
   # Build with EAS (or locally with npx expo prebuild + xcodebuild)
   eas build --profile e2e-simulator --platform ios --local

   # Run Detox
   npx detox test --configuration ios.sim.release
   ```

### Phase 2: Manual acceptance tests (real device, lock screen)

For the TTS-on-lock-screen scenario that can't be automated:

1. Build a development client: `eas build --profile development --platform ios`
2. Install on a real iPhone
3. Start a run with a 1 km target
4. Lock the phone, walk/simulate 0.5 km
5. Verify the "halfway" callout plays through the speaker
6. Verify the "finish" callout plays at 1 km

### Phase 3: CI integration (optional)

Detox tests can run on macOS GitHub Actions runners with Xcode:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [pull_request]
jobs:
  e2e:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: brew tap wix/brew && brew install applesimutils
      - run: npx detox build --configuration ios.sim.release
      - run: npx detox test --configuration ios.sim.release
```

Note: macOS runners are significantly more expensive than Linux runners.

---

## Summary

| Approach | Best for | Limitation |
|----------|----------|------------|
| **Detox** | Background location accumulation, app lifecycle | Cannot verify actual audio output |
| **Maestro** | Quick smoke tests, visual regression | Cannot observe internal state |
| **Manual real-device** | Lock-screen TTS, silence.wav hack | Not automatable |
| **xcrun simctl + GPX** | Realistic route simulation in CI | Simulator only |

**Recommendation:** Start with Detox for the background location scenario (it's
the highest-risk feature) and add `testID` props to the UI. Use manual testing on
a real device for the lock-screen TTS verification. Maestro is a good addition
later for visual smoke tests.

Sources:
- [Detox Device API](https://wix.github.io/Detox/docs/api/device/)
- [Maestro setLocation docs](https://docs.maestro.dev/api-reference/commands/setlocation)
- [Maestro Commands reference](https://docs.maestro.dev/api-reference/commands)
- [Expo Location SDK](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo Background Task](https://docs.expo.dev/versions/latest/sdk/background-task/)
- [Apple: Simulating location in tests](https://developer.apple.com/documentation/xcode/simulating-location-in-tests)
- [Location simulation in Xcode Simulator (SwiftLee)](https://www.avanderlee.com/workflow/location-simulation-xcode-simulator/)
- [set-simulator-location CLI](https://github.com/MobileNativeFoundation/set-simulator-location)
- [Detox vs Maestro vs Appium comparison (PkgPulse)](https://www.pkgpulse.com/blog/detox-vs-maestro-vs-appium-react-native-e2e-testing-2026)
- [Expo + Detox setup (Expo blog)](https://blog.expo.dev/testing-expo-apps-with-detox-and-react-native-testing-library-7fbdbb82ac87)
- [E2E tests with Expo dev client](https://medium.com/@Nicomalacho/e2e-tests-with-expo-development-client-b6c95b0678b3)
