import { memo } from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { CellText, Icon, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { useActiveWorkoutPillLogic } from '@/features/workouts/ui/components/ActiveWorkoutPill/ActiveWorkoutPill.logic';
import { createStyles } from '@/features/workouts/ui/components/ActiveWorkoutPill/ActiveWorkoutPill.style';

/**
 * The live-session pill, floating above the tab bar so it is reachable from every tab without
 * covering what the user is reading. The dot breathes: a static dot says a session exists, a
 * breathing one that it is happening now, which is what matters twenty minutes later.
 */
export const ActiveWorkoutPill = memo(function ActiveWorkoutPill({
  label,
  detail,
  onPress,
  theme,
}: {
  label: string;
  /** Elapsed time, or that the workout is paused. */
  detail?: string;
  onPress: () => void;
  theme: Theme;
}) {
  const { derived } = useActiveWorkoutPillLogic(label, detail);
  const { t } = useT();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={derived.accessibilityLabel}
      accessibilityHint={t('misc.opensWorkoutInProgress')}
      style={derived.pillStyle}
    >
      <Animated.View style={[styles.dot, derived.pulse]} />
      <CellText text={label} variant="label" weight="600" color={theme.colors.text} />
      {detail ? <CellText text={detail} variant="monoSm" color={theme.colors.textMuted} /> : null}
      <Icon name="chevronRight" size={15} color={theme.colors.textFaint} />
    </Pressable>
  );
});
