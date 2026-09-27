import { loadKitConfig } from '@timothyrusso/config-presets';
import arch from '@timothyrusso/eslint-plugin-arch';

const kitConfig = loadKitConfig({ cwd: import.meta.dirname });

/**
 * ESLint covers only what Biome does not: the kit's architecture rules and `no-restricted-syntax`
 * (no `enum`, no `as Error`), driven by `kit.config.json`. Written by `config-presets init`.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      'ios/**',
      'android/**',
      'artifacts/**',
      'build/**',
      '.playwright-mcp/**',
    ],
  },
  ...arch.configs.recommended(kitConfig),
];
