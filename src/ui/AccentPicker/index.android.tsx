/**
 * The accent-colour preference on Android: a row of swatches, one per choice.
 *
 * Swatches rather than a list of names, because the choice is a colour and seeing it is the
 * decision. Each is a radio button to TalkBack, named in words. The wallpaper option appears
 * only where Material You exists (Android 12+); below that it would be the static baseline
 * palette under a misleading name.
 */
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isDynamicColorAvailable } from '@expo/ui/jetpack-compose';

import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import { ACCENT_CHOICES, useSettings, useSettingsUpdate, type AccentChoice } from '@/settings';
import { useAccentSwatches } from '@/theme/accent';
import { useAppTheme, type Theme } from '@/theme/theme';
import { spacing, touchTarget } from '@/theme/tokens';
import { Icon } from '@/ui/icons';
import { Txt } from '@/ui/Text';

/** Catalog keys: module scope has no language. */
const NAMES: Record<AccentChoice, TKey> = {
  kinetiq: 'accent.kinetiq',
  system: 'accent.system',
  ocean: 'accent.ocean',
  sunset: 'accent.sunset',
  berry: 'accent.berry',
  ruby: 'accent.ruby',
};

const CHOICES = ACCENT_CHOICES.filter((choice) => choice !== 'system' || isDynamicColorAvailable);
const SWATCH = 36;

export function AccentPreference() {
  const { t } = useT();
  const theme = useAppTheme();
  const choice = useSettings((s) => s.accentColor);
  const update = useSettingsUpdate();
  const swatches = useAccentSwatches(theme.mode);
  const pick = useCallback((next: AccentChoice) => update({ accentColor: next }), [update]);
  if (swatches === null) return null;

  return (
    <View style={styles.block}>
      <Txt variant="strong">{t('accent.title')}</Txt>
      <Txt variant="caption" tone="muted">
        {t('accent.hint')}
      </Txt>
      <View style={styles.row} accessibilityRole="radiogroup">
        {CHOICES.map((option) => (
          <Swatch
            key={option}
            option={option}
            color={swatches[option]}
            label={t(NAMES[option])}
            selected={option === choice}
            theme={theme}
            onPick={pick}
          />
        ))}
      </View>
    </View>
  );
}

const Swatch = memo(function Swatch({
  option,
  color,
  label,
  selected,
  theme,
  onPick,
}: {
  option: AccentChoice;
  color: string;
  label: string;
  selected: boolean;
  theme: Theme;
  onPick: (option: AccentChoice) => void;
}) {
  const press = useCallback(() => onPick(option), [onPick, option]);
  return (
    <Pressable
      onPress={press}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      android_ripple={{ color: theme.colors.surfacePressed, borderless: true, radius: touchTarget / 2 }}
      style={styles.hit}
    >
      <View
        style={[
          styles.ring,
          { borderColor: selected ? theme.colors.text : 'transparent' },
        ]}
      >
        <View style={[styles.swatch, { backgroundColor: color }]}>
          {selected ? <Icon name="check" size={18} color={theme.colors.background} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hit: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2, borderRadius: SWATCH, padding: 2 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
