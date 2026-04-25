const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  path.resolve(__dirname, "../../packages/schema"),
  path.resolve(__dirname, "../../packages/types"),
  path.resolve(__dirname, "../../packages/api-client"),
  path.resolve(__dirname, "../../packages/design-tokens"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
