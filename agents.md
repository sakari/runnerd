# Agents

## Rules

- Do not change the pnpm `minimumReleaseAge` settings without explicit permission from the user.
- Use `npx expo install <package>` to install Expo packages. This ensures the installed version is compatible with the project's Expo SDK version.
- Never force push or rebase. Always merge.
- **IMPORTANT:** Always include the Claude Code session URL (`https://claude.ai/code/session_<id>`) in the PR summary so the originating session can be traced from the PR.
- **IMPORTANT:** Always subscribe to PR activity for any PR you create (via `subscribe_pr_activity`) so CI failures and review comments can be handled promptly.
- Release device builds must go through `pnpm ios:release`, which clears `DEVELOPMENT_TEAM` in the pbxproj first via `scripts/clear-ios-team.mjs`. Expo skips the code-signing step on subsequent `expo run:ios` invocations once a team is set, so `-allowProvisioningUpdates` isn't passed and the build fails after the 7-day free-account provisioning profile expires. Clearing the team forces Expo back through the signing-configuration path on every build while keeping `ios/Pods` and DerivedData intact for an incremental build.
- A gitleaks pre-commit hook is installed via `.githooks/pre-commit` (activated by the `prepare` npm script). Do not bypass it with `--no-verify` unless a finding has been reviewed and confirmed as a false positive. If gitleaks isn't installed locally, install it so the hook is active:
  ```bash
  mkdir -p ~/.local/bin && \
  curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
    | tar -xz -C ~/.local/bin gitleaks && chmod +x ~/.local/bin/gitleaks
  ```
- Keep `docs/privacy-policy.html` in sync with what the app actually does. Whenever a change affects any of the following, update the policy in the same PR and bump its "Last updated" date:
  - **Data collection or storage** — new sensors/permissions (camera, microphone, motion, HealthKit, contacts, photos), new fields persisted to SQLite, new on-device caches of personal data.
  - **Network behavior** — any outbound request, sync, backup (iCloud, CloudKit), crash reporting, remote config, or push notifications. Runnerd is currently local-only; adding a network call is a policy-affecting change.
  - **Third-party SDKs** — adding analytics, advertising, attribution, A/B testing, or any SDK that can phone home. The policy currently states there are none; adding one requires updating sections 2, 3, 4, and 7.
  - **Tracking** — anything that would flip the App Privacy answer for "Used for Tracking" or require an `NSUserTrackingUsageDescription` / ATT prompt.
  - **Background modes or permission strings** — changes to `app.json` `ios.infoPlist` (purpose strings, `UIBackgroundModes`, `ITSAppUsesNonExemptEncryption`) must be reflected in the policy's background-location and permissions sections.
  - **Data deletion paths** — if the way users delete data changes, update section 8.
