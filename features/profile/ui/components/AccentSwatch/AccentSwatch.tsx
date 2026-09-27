import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, useStyles } from '@/features/core/design-system';
import type { AccentChoice, Theme } from '@/features/core/theme';
import { useAccentSwatchLogic } from '@/features/profile/ui/components/AccentSwatch/AccentSwatch.logic';
import { createStyles } from '@/features/profile/ui/components/AccentSwatch/AccentSwatch.style';

/** One accent choice: a radio button to VoiceOver and TalkBack, named in words. */
export const AccentSwatch = memo(function AccentSwatch({
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
  const { derived, effects } = useAccentSwatchLogic(option, color, selected, theme, onPick);
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={effects.press}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      android_ripple={derived.ripple}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      <View style={[styles.ring, derived.ring]}>
        <View style={[styles.swatch, derived.fill]}>
          {selected ? <Icon name="check" size={18} color={theme.colors.background} /> : null}
        </View>
      </View>
    </Pressable>
  );
});
