const preset = require('@timothyrusso/config-presets/jest');

/**
 * The kit's Jest preset (jest-expo, the `@/` alias, the `@timothyrusso/*` transform) plus one app
 * delta: `@/` tries `src/` first and then the root, so `@/features/...` resolves while the legacy
 * `src/` tree still exists (#54 deletes it), `artifacts/` and `build/` hold local output, never
 * tests, and `jestSetup.ts` stubs the one native module jest cannot load.
 */
const config = {
  ...preset,
  moduleNameMapper: { '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/$1'] },
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/(artifacts|build)/'],
  setupFiles: ['<rootDir>/features/core/testing/jestSetup.ts'],
};

module.exports = config;
