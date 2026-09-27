const preset = require('@timothyrusso/config-presets/jest');

/**
 * The kit's Jest preset (jest-expo, the `@/` alias, the `@timothyrusso/*` transform) plus one app
 * delta: `@/` still points at `src/` until #54 deletes it, and `artifacts/` and `build/` hold
 * local output, never tests.
 */
const config = {
  ...preset,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/(artifacts|build)/'],
};

module.exports = config;
