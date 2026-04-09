const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};
