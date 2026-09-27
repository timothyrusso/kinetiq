import { useCallback, useMemo } from 'react';
import { ACCENT_CHOICES, type AccentChoice, type Theme, useAccentSwatches } from '@/features/core/theme';
import { type TKey, useT } from '@/features/core/translations';
import { useSettings, useSettingsUpdate } from '@/features/settings';

/** Catalog keys: module scope has no language. */
const NAMES: Record<AccentChoice, TKey> = {
  kinetiq: 'accent.kinetiq',
  system: 'accent.system',
  ocean: 'accent.ocean',
  sunset: 'accent.sunset',
  berry: 'accent.berry',
  ruby: 'accent.ruby',
};

/**
 * The accent-colour preference: one swatch per choice the platform can offer (`useAccentSwatches`
 * leaves out the others), each named in words for VoiceOver and TalkBack.
 */
export function useAccentPreferenceLogic(theme: Theme) {
  const { t } = useT();
  const choice = useSettings(settings => settings.accentColor);
  const update = useSettingsUpdate();
  const colors = useAccentSwatches(theme.mode);
  const swatches = useMemo(
    () =>
      ACCENT_CHOICES.flatMap(option => {
        const color = colors[option];
        return color === undefined ? [] : [{ option, color, label: t(NAMES[option]) }];
      }),
    [colors, t],
  );
  const pick = useCallback((next: AccentChoice) => update({ accentColor: next }), [update]);
  return { state: { choice }, derived: { title: t('accent.title'), swatches }, effects: { pick } };
}
