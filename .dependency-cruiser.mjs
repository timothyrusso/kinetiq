import {
  createDependencyCruiserConfig,
  DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS,
  DEFAULT_TSX_PUBLIC_API_EXCEPTIONS,
} from '@timothyrusso/arch-rules';
import { loadKitConfig } from '@timothyrusso/config-presets';

/**
 * Core concerns a `.tsx` may import at runtime besides the kit defaults: the sources of the hooks
 * `lint.allowedHooksInViews` lets a view call (`useAppTheme`, `useT`, `useHaptics`), the pure
 * formatters the design system draws with, and `core/error`, whose `isOfflineFailure` the design
 * system's `ErrorState` reads the error it is handed with.
 */
const TSX_PUBLIC_API_EXCEPTIONS = [
  ...DEFAULT_TSX_PUBLIC_API_EXCEPTIONS,
  'core/theme',
  'core/translations',
  'core/haptics',
  'core/utils',
  'core/error',
];

/**
 * Core concerns `domain/` may import at runtime besides `core/error`: the value sets a domain
 * Schema validates against (`ACCENT_CHOICES` in `core/theme`) and the pure helpers (`clamp` in
 * `core/utils`), so a feature's Schema reads the one list instead of a copy of it.
 */
const DOMAIN_PUBLIC_API_EXCEPTIONS = [...DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS, 'core/theme', 'core/utils'];

/**
 * Architecture rules generated from each feature's `FEATURE_TIER` and `kit.config.json`: tiers,
 * public API boundaries, layers and Effect placement. Run by `npm run check:arch`. Written by
 * `config-presets init`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
export default createDependencyCruiserConfig(loadKitConfig({ cwd: import.meta.dirname }), {
  rootDir: import.meta.dirname,
  tsxPublicApiExceptions: TSX_PUBLIC_API_EXCEPTIONS,
  domainPublicApiExceptions: DOMAIN_PUBLIC_API_EXCEPTIONS,
});
