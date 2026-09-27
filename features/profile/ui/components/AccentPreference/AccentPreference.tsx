import { View } from 'react-native';
import { Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useAccentPreferenceLogic } from '@/features/profile/ui/components/AccentPreference/AccentPreference.logic';
import { createStyles } from '@/features/profile/ui/components/AccentPreference/AccentPreference.style';
import { AccentSwatch } from '@/features/profile/ui/components/AccentSwatch/AccentSwatch';

/**
 * A row of swatches, one per accent choice. Swatches rather than a list of names, because the
 * choice is a colour and seeing it is the decision (the pattern of the iOS Reminders list colours
 * and of Material's colour pickers alike). On iOS, where the brand accent stays, it renders only
 * the choices the platform offers.
 */
export function AccentPreference() {
  const theme = useAppTheme();
  const { state, derived, effects } = useAccentPreferenceLogic(theme);
  const styles = useStyles(createStyles);
  return (
    <View style={styles.block}>
      <Txt variant="strong">{derived.title}</Txt>
      <View style={styles.row} accessibilityRole="radiogroup">
        {derived.swatches.map(swatch => (
          <AccentSwatch
            key={swatch.option}
            option={swatch.option}
            color={swatch.color}
            label={swatch.label}
            selected={swatch.option === state.choice}
            theme={theme}
            onPick={effects.pick}
          />
        ))}
      </View>
    </View>
  );
}
