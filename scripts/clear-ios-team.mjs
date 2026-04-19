// Clears DEVELOPMENT_TEAM from ios/runnerd.xcodeproj/project.pbxproj so that
// `expo run:ios` treats code signing as unconfigured and re-invokes xcodebuild
// with -allowProvisioningUpdates. Without this, a free Apple ID's 7-day
// provisioning profile expires and rebuilds fail with "No profiles for
// 'com.runnerd.app' were found".
//
// Depends on Expo's isCodeSigningConfigured check:
// node_modules/@expo/cli/build/src/run/ios/codeSigning/xcodeCodeSigning.js

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const pbxproj = "ios/runnerd.xcodeproj/project.pbxproj";

if (!existsSync(pbxproj)) {
  process.exit(0);
}

const original = readFileSync(pbxproj, "utf8");
const cleared = original.replace(
  /DEVELOPMENT_TEAM = [^;]+;/g,
  'DEVELOPMENT_TEAM = "";',
);

if (cleared !== original) {
  writeFileSync(pbxproj, cleared);
}
