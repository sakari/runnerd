const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (mod) => {
    console.log(
      "[local-notifications-only] before:",
      JSON.stringify(mod.modResults),
    );
    delete mod.modResults["aps-environment"];
    console.log(
      "[local-notifications-only] after:",
      JSON.stringify(mod.modResults),
    );
    return mod;
  });
};
