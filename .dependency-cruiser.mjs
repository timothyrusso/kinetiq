import {
  createDependencyCruiserConfig,
  DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS,
  DEFAULT_TSX_PUBLIC_API_EXCEPTIONS,
} from '@timothyrusso/arch-rules';
import { loadKitConfig } from '@timothyrusso/config-presets';

/** Code that predates the kit architecture, as a dependency-cruiser path pattern. */
const LEGACY = '^(src|app|modules)/';

/**
 * Rules the legacy tree breaks today. Each child of #47 that moves the offending code into
 * `features/` removes its rule from this list.
 */
const LEGACY_WARN = new Set(['tsx-no-runtime-domain-import', 'no-circular']);

/**
 * Splits a rule in two: `error` everywhere but the legacy tree, `warn` inside it.
 *
 * @param {import('dependency-cruiser').IForbiddenRuleType} rule
 */
function warnOnLegacy(rule) {
  const from = rule.from ?? {};
  const legacyPath = from.path ? `${LEGACY}.*${from.path}` : LEGACY;
  return [
    { ...rule, from: { ...from, pathNot: LEGACY } },
    { ...rule, name: `${rule.name}-legacy`, severity: 'warn', from: { ...from, path: legacyPath } },
  ];
}

/**
 * Core concerns a `.tsx` may import at runtime besides the kit defaults: the sources of the hooks
 * `lint.allowedHooksInViews` lets a view call (`useAppTheme`, `useT`, `useHaptics`), and the pure
 * formatters the design system draws with.
 */
const TSX_PUBLIC_API_EXCEPTIONS = [
  ...DEFAULT_TSX_PUBLIC_API_EXCEPTIONS,
  'core/theme',
  'core/translations',
  'core/haptics',
  'core/utils',
];

/**
 * Core concerns `domain/` may import at runtime besides `core/error`: the value sets a domain
 * Schema validates against (`ACCENT_CHOICES` in `core/theme`) and the pure helpers (`clamp` in
 * `core/utils`), so a feature's Schema reads the one list instead of a copy of it.
 */
const DOMAIN_PUBLIC_API_EXCEPTIONS = [...DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS, 'core/theme', 'core/utils'];

const config = createDependencyCruiserConfig(loadKitConfig({ cwd: import.meta.dirname }), {
  rootDir: import.meta.dirname,
  tsxPublicApiExceptions: TSX_PUBLIC_API_EXCEPTIONS,
  domainPublicApiExceptions: DOMAIN_PUBLIC_API_EXCEPTIONS,
});

/**
 * Architecture rules generated from each feature's `FEATURE_TIER` and `kit.config.json`: tiers,
 * public API boundaries, layers and Effect placement. Run by `npm run check:arch`. Written by
 * `config-presets init`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
export default {
  ...config,
  forbidden: config.forbidden.flatMap(rule => (LEGACY_WARN.has(rule.name) ? warnOnLegacy(rule) : [rule])),
};
