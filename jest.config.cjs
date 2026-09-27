const { withKitTransforms: _withKitTransforms, ...preset } = require('@timothyrusso/config-presets/jest');

/**
 * The kit's Jest preset (jest-expo, the `@/` alias, the `@timothyrusso/*` transform) plus the app's
 * deltas:
 *
 * - `artifacts/` and `build/` hold local output, never tests.
 * - `jestSetup.ts` stubs the one native module jest cannot load; `__mocks__/` at the root holds
 *   Reanimated's own mock, so the design system and navigation barrels load under Node.
 * - `expo-asset` is nested under `expo` rather than hoisted: Metro finds it there and jest does
 *   not, and `@expo/vector-icons` needs it through `expo-font`.
 * - Coverage: the measurement and the global floors of the kit's `TESTING.md` (the installed
 *   preset predates them); `scripts/check-coverage.js` adds the app's floor on the inner layers.
 */
const config = {
  ...preset,
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/(artifacts|build)/'],
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    '^expo-asset$': '<rootDir>/node_modules/expo/node_modules/expo-asset',
  },
  setupFiles: ['<rootDir>/features/core/testing/jestSetup.ts'],
  setupFilesAfterEnv: ['<rootDir>/features/core/testing/jestAfterEnv.ts'],
  collectCoverageFrom: [
    '<rootDir>/features/**/*.ts',
    '!<rootDir>/**/*.style.ts',
    '!<rootDir>/**/*.d.ts',
    '!<rootDir>/**/index.ts',
    '!<rootDir>/**/pages.ts',
    '!<rootDir>/**/di/**',
    '!<rootDir>/**/libraries/**',
    '!<rootDir>/**/__tests__/**',
    '!<rootDir>/**/__fixtures__/**',
    '!<rootDir>/features/core/testing/**',
  ],
  coverageReporters: ['text-summary', 'json-summary'],
  coverageThreshold: { global: { lines: 70, branches: 55, functions: 70, statements: 70 } },
};

module.exports = config;
