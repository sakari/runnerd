# Runnerd

A running tracker app built with React Native and Expo. Tracks distance, duration, and pace with GPS, and provides voice callouts during runs.

## Setup

```bash
pnpm install
```

## Development

Start the Metro dev server:

```bash
pnpm start
```

Then open the app in Expo Go on your phone by scanning the QR code.

## Install on iPhone (no paid Apple Developer account)

You can build and install a standalone release build on your iPhone for 7 days using a free Apple ID. Requires a Mac with Xcode installed.

1. Connect your iPhone via USB
2. Run:
   ```bash
   pnpm ios:release
   ```
3. Select your device when prompted
4. Go to **Settings > General > VPN & Device Management** on your phone and trust your developer certificate

The app runs standalone — no dev server needed. Reinstall every 7 days when the provisioning profile expires.

`pnpm ios:release` clears `DEVELOPMENT_TEAM` in `ios/runnerd.xcodeproj/project.pbxproj` before building. This forces Expo to re-run its code-signing configuration, which passes `-allowProvisioningUpdates` to xcodebuild so Xcode can fetch a new 7-day profile from Apple. Without the clear, Expo skips that step once signing is already configured and xcodebuild fails with "No profiles for 'com.runnerd.app' were found" after the old profile expires. `ios/Pods` and DerivedData are left alone, so the rebuild is incremental. Free Apple IDs also tend to rotate the signing certificate on each re-provisioning, which is why step 4 needs repeating.

## Production build (paid Apple Developer account)

```bash
pnpm add -g eas-cli
eas login
eas build --platform ios --profile production
```

## Tip jar (RevenueCat Test Store)

Runnerd has an optional one-off tip that unlocks nothing and shows a
"Supporter since …" badge once paid. It runs against the RevenueCat **Test
Store**, so it needs no paid Apple Developer account and no App Store Connect
products.

The Test Store key is committed in `REVENUECAT_TEST_KEY`
(`src/core/tips.ts`). It is a public client key that ships inside the app
binary either way, so committing it is not a leak — see
`docs/revenuecat-tip-plan.md` for the reasoning and for the guard that stops a
`test_` key reaching a production build. Setting it to `""` disables the
feature entirely: the SDK is never configured and the widget renders nothing.

The dashboard needs a non-subscription product priced at roughly EUR 1, in the
`default` offering, attached to a `supporter` entitlement. `e2e/tip.yaml`
asserts against that setup unconditionally.

The tip path needs a native build (`pnpm ios` or `pnpm ios:release`). In Expo
Go the SDK falls back to Preview API Mode and the tip button silently does
nothing.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Start Metro dev server |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint source files |
| `pnpm format` | Format source files |
| `pnpm format:check` | Check formatting |
