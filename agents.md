# Agents

## Rules

- Do not change the pnpm `minimumReleaseAge` settings without explicit permission from the user.
- Use `npx expo install <package>` to install Expo packages. This ensures the installed version is compatible with the project's Expo SDK version.
- Never force push or rebase. Always merge.
- Release device builds must go through `pnpm ios:release`, which clears `DEVELOPMENT_TEAM` in the pbxproj first via `scripts/clear-ios-team.mjs`. Expo skips the code-signing step on subsequent `expo run:ios` invocations once a team is set, so `-allowProvisioningUpdates` isn't passed and the build fails after the 7-day free-account provisioning profile expires. Clearing the team forces Expo back through the signing-configuration path on every build while keeping `ios/Pods` and DerivedData intact for an incremental build.
