const { getDefaultConfig } = require('expo/metro-config');

// NOTE: Expo's Metro config resolves `tsconfig.json` `paths` (`@/*` to the root) by default on
// SDK 51+, so no custom alias wiring is needed here.
const config = getDefaultConfig(__dirname);

module.exports = config;
