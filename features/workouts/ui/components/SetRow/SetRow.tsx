import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton, MetricLabel, Row, Txt, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { trimNumber, weightUnit } from '@/features/core/utils';
import { type SetRowInput, useSetRowLogic } from '@/features/workouts/ui/components/SetRow/SetRow.logic';
import { createStyles } from '@/features/workouts/ui/components/SetRow/SetRow.style';

/**
 * One planned set: the target on the left and the checkbox on the right, the important half.
 * `isTarget` outlines the next unticked set, which answers "which one am I on?" without counting;
 * an outline rather than a fill, which would compete with the filled done state. On the filled
 * accent disc the number takes the accent's own ink, or a ticked set reads as a blank disc. The
 * session screen plays the tick's haptic, so the checkbox is silent.
 */
export const SetRow = memo(function SetRow(props: SetRowInput & { theme: Theme }) {
  const { set, setIndex, units, theme } = props;
  const { derived, effects } = useSetRowLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <Row gap="md" align="center" style={styles.row}>
      <View style={[styles.number, set.completed ? styles.numberDone : null]}>
        <Txt
          variant="micro"
          weight="700"
          tone="muted"
          color={set.completed ? theme.colors.onAccent : undefined}
          style={styles.numeral}
        >
          {derived.number}
        </Txt>
      </View>

      <Pressable
        onPress={effects.open}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.setRepsAt', { n: setIndex + 1, reps: set.reps, weight: derived.weightText })}
        accessibilityHint={t('setRow.opensEditor')}
        style={derived.valueStyle}
      >
        <MetricLabel label={t('setRow.reps')} />
        <Txt variant="subhead" weight="700" tone={set.completed ? 'muted' : 'default'} style={styles.numeral}>
          {set.reps}
        </Txt>
      </Pressable>

      <Pressable
        onPress={effects.open}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.setWeight', { n: setIndex + 1, weight: derived.weightText })}
        accessibilityHint={t('setRow.opensEditor')}
        style={derived.valueStyle}
      >
        <MetricLabel label={t('setRow.weightIn', { unit: weightUnit(units) })} />
        <Txt variant="subhead" weight="700" tone={set.completed ? 'muted' : 'default'} style={styles.numeral}>
          {set.weightKg === 0 ? t('setRow.bodyweightShort') : trimNumber(set.weightKg)}
        </Txt>
      </Pressable>

      <IconButton
        name={set.completed ? 'checkCircle' : 'check'}
        variant={set.completed ? 'accent' : 'plain'}
        size={24}
        silent
        accessibilityLabel={t(set.completed ? 'setRow.markNotDone' : 'setRow.completeSet', { n: setIndex + 1 })}
        onPress={effects.toggle}
      />
    </Row>
  );
});
