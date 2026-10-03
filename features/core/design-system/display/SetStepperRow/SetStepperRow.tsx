import { memo, type Ref } from 'react';
import { View } from 'react-native';
import { Stepper } from '@/features/core/design-system/controls/Stepper';
import { Badge } from '@/features/core/design-system/display/Badge';
import { RowButton } from '@/features/core/design-system/display/RowButton';
import {
  type SetStepperRowInput,
  useSetStepperRowLogic,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperRow.logic';
import { createStyles } from '@/features/core/design-system/display/SetStepperRow/SetStepperRow.style';
import { useStyles } from '@/features/core/design-system/styles/useStyles';
import { Txt } from '@/features/core/design-system/text/Text';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

type Bounds = { readonly min: number; readonly max: number };

/**
 * One set of an exercise being edited: its number, then reps, weight and RPE, each a compact
 * stepper on its own line with what it adjusts beside it, the way a settings stepper row reads.
 * The routine item sheet and the live workout's exercise sheet both draw their sets with it; each
 * owns how a change is written. The rows are the few sets of one exercise in a form, not a
 * scrolling list: each stepper's native control is sized once and never recycled. Every value is
 * a primitive and every callback takes the index.
 *
 * A workout's row says when its set is done and can be `highlighted`, the set that was tapped to
 * open the sheet; `ref` lets the sheet scroll to it.
 */
export const SetStepperRow = memo(function SetStepperRow(
  props: SetStepperRowInput & {
    reps: number;
    weight: number;
    rpe: number;
    repsBounds: Bounds;
    rpeBounds: Bounds;
    weightMax: number;
    weightStep: number;
    canRemove: boolean;
    topDivider: boolean;
    highlighted: boolean;
    theme: Theme;
    ref?: Ref<View>;
  },
) {
  const {
    reps,
    weight,
    rpe,
    repsBounds,
    rpeBounds,
    weightMax,
    weightStep,
    unit,
    completed,
    canRemove,
    topDivider,
    highlighted,
    theme,
    ref,
  } = props;
  const { derived, effects } = useSetStepperRowLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <View ref={ref} style={[styles.row, topDivider ? styles.divider : null, highlighted ? styles.highlighted : null]}>
      <View style={styles.head}>
        <Txt variant="strong" accessibilityRole="header" accessibilityLabel={derived.labels.titleA11y}>
          {derived.labels.title}
        </Txt>
        {completed ? <Badge label={t('itemEditor.setDone')} tone="success" /> : null}
        <View style={styles.flex} />
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
          {derived.labels.rpeLabel}
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
