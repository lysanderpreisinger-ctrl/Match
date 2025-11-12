const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Alias NUR in Entwicklung aktivieren
const isDev = process.env.NODE_ENV !== "production";
if (isDev) {
  config.resolver = config.resolver || {};
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    PushNotificationIOS: require.resolve("./jest-mock-pushnotificationios.js"),
  };
}

module.exports = config;
