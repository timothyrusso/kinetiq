const preset = require('@timothyrusso/config-presets/jest');

/**
 * The kit's Jest preset (jest-expo, the `@/` alias, the `@timothyrusso/*` transform) plus the app's
 * deltas: `artifacts/` and `build/` hold local output, never tests, and `jestSetup.ts` stubs the
 * one native module jest cannot load.
 */
const config = {
  ...preset,
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/(artifacts|build)/'],
  setupFiles: ['<rootDir>/features/core/testing/jestSetup.ts'],
};

module.exports = config;
