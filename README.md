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
   npx expo run:ios --device --configuration Release
   ```
3. Select your device when prompted
4. On first install, go to **Settings > General > VPN & Device Management** on your phone and trust your developer certificate

The app runs standalone — no dev server needed. Reinstall every 7 days when the provisioning profile expires.

## Production build (paid Apple Developer account)

```bash
pnpm add -g eas-cli
eas login
eas build --platform ios --profile production
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Start Metro dev server |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint source files |
| `pnpm format` | Format source files |
| `pnpm format:check` | Check formatting |
