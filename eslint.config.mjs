import { loadKitConfig } from '@timothyrusso/config-presets';
import arch, { DEFAULT_RELATIVE_IMPORT_ALLOW } from '@timothyrusso/eslint-plugin-arch';

const kitConfig = loadKitConfig({ cwd: import.meta.dirname });
const { gutterToken, allowlistFile } = kitConfig.lint.layoutTokens;

/**
 * Code that predates the kit architecture. Each child of #47 moves a folder into `features/` and
 * drops it from this list, so the moved code is checked at `error`.
 */
/** Where legacy files import the spacing scale from: the re-export of `spacingImport`. */
const LEGACY_SPACING_IMPORT = '@/theme/tokens';

const LEGACY = ['src/**', 'app/**', 'modules/**', 'scripts/**', 'targets/**', 'metro.config.js'];

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
  // NOTE: the recommended config checks the gutter in `app/` and `features/core/design-system/`
  // against `spacingImport`; legacy files still import the scale through the `@/theme/tokens`
  // re-export, and the feature components left in `src/ui/` keep the check they had, until the
  // children of #47 move them.
  {
    name: 'kinetiq/legacy-gutter',
    files: ['app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: {
      'arch/no-literal-gutter': ['error', { gutterToken, spacingImport: LEGACY_SPACING_IMPORT, allowlistFile }],
    },
  },
  // NOTE: legacy code fails these two until it moves; later children of #47 flip them to error
  // by removing the folder from LEGACY.
  {
    name: 'kinetiq/legacy-warn',
    files: LEGACY,
    rules: {
      'arch/no-inline-comments': 'warn',
      'arch/no-relative-imports': ['warn', { allow: [...DEFAULT_RELATIVE_IMPORT_ALLOW] }],
    },
  },
];
