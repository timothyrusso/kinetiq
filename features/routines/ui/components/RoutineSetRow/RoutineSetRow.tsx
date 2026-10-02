import { memo } from 'react';
import { View } from 'react-native';
import { RowButton, Stepper, Txt, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import {
  type RoutineSetRowInput,
  useRoutineSetRowLogic,
} from '@/features/routines/ui/components/RoutineSetRow/RoutineSetRow.logic';
import { createStyles } from '@/features/routines/ui/components/RoutineSetRow/RoutineSetRow.style';

type Bounds = { readonly min: number; readonly max: number };

/**
 * One set of a routine item: its number, then reps, weight and target RPE, each a compact stepper
 * on its own line with what it adjusts beside it, the way a settings stepper row reads. The rows
 * are the few sets of one exercise in a form, not a scrolling list: each stepper's native control
 * is sized once and never recycled. Every value is a primitive and every callback takes the index.
 */
export const RoutineSetRow = memo(function RoutineSetRow(
  props: RoutineSetRowInput & {
    reps: number;
    weight: number;
    rpe: number;
    repsBounds: Bounds;
    rpeBounds: Bounds;
    weightMax: number;
    weightStep: number;
    canRemove: boolean;
    topDivider: boolean;
    theme: Theme;
  },
) {
  const { reps, weight, rpe, repsBounds, rpeBounds, weightMax, weightStep, unit, canRemove, topDivider, theme } = props;
  const { derived, effects } = useRoutineSetRowLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <View style={[styles.row, topDivider ? styles.divider : null]}>
      <View style={styles.head}>
        <Txt variant="strong" accessibilityRole="header" style={styles.flex}>
          {derived.labels.title}
        </Txt>
        <RowButton
          icon="trash"
          tone="danger"
          label={derived.labels.remove}
          disabled={!canRemove}
          theme={theme}
          onPress={effects.remove}
        />
      </View>
      <View style={styles.line}>
        <Txt variant="label" tone="muted" style={styles.flex}>
          {t('itemEditor.reps')}
        </Txt>
        <Stepper
          label={derived.labels.reps}
          value={reps}
          min={repsBounds.min}
          max={repsBounds.max}
          step={1}
          compact
          onChange={effects.changeReps}
        />
      </View>
      <View style={styles.line}>
        <Txt variant="label" tone="muted" style={styles.flex}>
          {t('itemEditor.weightIn', { unit })}
        </Txt>
        <Stepper
          label={derived.labels.weight}
          value={weight}
          min={0}
          max={weightMax}
          step={weightStep}
          decimal
          compact
          onChange={effects.changeWeight}
        />
      </View>
      <View style={styles.line}>
        <Txt variant="label" tone="muted" style={styles.flex}>
          {t('itemEditor.targetRpe')}
        </Txt>
        <Stepper
          label={derived.labels.rpe}
          value={rpe}
          min={rpeBounds.min}
          max={rpeBounds.max}
          step={1}
          compact
          onChange={effects.changeRpe}
        />
      </View>
    </View>
  );
});
