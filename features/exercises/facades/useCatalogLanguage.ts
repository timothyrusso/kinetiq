import { resolveLanguage } from '@/features/core/translations';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { useSettings } from '@/features/settings';

/** The language catalog rows render in: the in-app setting `useT` reads, not the device locale. */
export function useCatalogLanguage(): CatalogLanguage {
  return resolveLanguage(useSettings(settings => settings.language));
}
