/**
 * The accent-colour preference: a row of swatches, one per choice.
 *
 * Swatches rather than a list of names, because the choice is a colour and seeing it is the
 * decision (the pattern of the iOS Reminders list colours and of Material's colour pickers
 * alike). Each is a radio button to VoiceOver and TalkBack, named in words. Which choices exist
 * is the platform's answer: `useAccentSwatches` leaves out the ones it cannot offer.
 */
import { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

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

const SWATCH = 36;

export function AccentPreference() {
  const { t } = useT();
  const theme = useAppTheme();
  const choice = useSettings((s) => s.accentColor);
  const update = useSettingsUpdate();
  const swatches = useAccentSwatches(theme.mode);
  const pick = useCallback((next: AccentChoice) => update({ accentColor: next }), [update]);

  return (
    <View style={styles.block}>
      <Txt variant="strong">{t('accent.title')}</Txt>
      <View style={styles.row} accessibilityRole="radiogroup">
        {ACCENT_CHOICES.map((option) => {
          const color = swatches[option];
          if (color === undefined) return null;
          return (
            <Swatch
              key={option}
              option={option}
              color={color}
              label={t(NAMES[option])}
              selected={option === choice}
              theme={theme}
              onPick={pick}
            />
          );
        })}
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
      android_ripple={{
        color: theme.colors.surfacePressed,
        borderless: true,
        radius: touchTarget / 2,
      }}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      <View style={[styles.ring, { borderColor: selected ? theme.colors.text : 'transparent' }]}>
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
  // Android answers a press with the ripple; iOS dims, as its own controls do.
  pressed: { opacity: Platform.select({ ios: 0.5, default: 1 }) },
  hit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderWidth: 2, borderRadius: SWATCH, padding: 2 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
