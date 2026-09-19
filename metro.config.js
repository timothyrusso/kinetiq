const { getDefaultConfig } = require('expo/metro-config');

// Expo's Metro config resolves `tsconfig.json` `paths` (`@/*` -> `src/*`) by
// default on SDK 51+, so no custom alias wiring is needed here.
const config = getDefaultConfig(__dirname);

module.exports = config;
