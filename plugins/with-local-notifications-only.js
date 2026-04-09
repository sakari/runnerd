const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withLocalNotificationsOnly(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const entitlementsPath = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        `${config.modRequest.projectName}.entitlements`,
      );
      if (fs.existsSync(entitlementsPath)) {
        let contents = fs.readFileSync(entitlementsPath, "utf-8");
        // Remove the aps-environment key/value pair
        contents = contents.replace(
          /\s*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>/g,
          "",
        );
        fs.writeFileSync(entitlementsPath, contents);
      }
      return config;
    },
  ]);
};
