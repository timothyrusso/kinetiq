import type { ReactNode, Ref } from 'react';
import { View } from 'react-native';
import { Stepper } from '@/features/core/design-system/controls/Stepper';
import { Badge } from '@/features/core/design-system/display/Badge';
import { RowButton } from '@/features/core/design-system/display/RowButton';
import { createStyles } from '@/features/core/design-system/display/SetStepperRow/SetStepperRow.style';
import { useStyles } from '@/features/core/design-system/styles/useStyles';
import { Txt } from '@/features/core/design-system/text/Text';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

export type StepperBounds = { readonly min: number; readonly max: number };

/** The labels the frame draws, from `useSetStepperBase`. */
export interface SetStepperFrameLabels {
  readonly title: string;
  readonly titleA11y: string;
  readonly rpeLabel: string;
  readonly rpe: string;
  readonly remove: string;
}

/** What every set row takes besides the values of its own type. */
export interface SetStepperFrameProps {
  readonly rpe: number;
  readonly rpeBounds: StepperBounds;
  readonly canRemove: boolean;
  readonly topDivider: boolean;
  readonly highlighted: boolean;
  readonly theme: Theme;
  readonly ref?: Ref<View>;
}

/**
 * One line of a set row: what it adjusts on the left, the compact stepper on the right, the way a
 * settings stepper row reads.
 */
export function StepperLine({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.line}>
      <Txt variant="label" tone="muted" style={styles.flex}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

/**
 * What every set row draws whatever its type records: the set's number, its done badge and its
 * remove button on top, the lines of its type (`children`), then its RPE. A workout's row can be
 * `highlighted`, the set that was tapped to open the sheet; `ref` lets the sheet scroll to it.
 */
export function SetStepperFrame({
  labels,
  rpe,
  rpeBounds,
  completed,
  canRemove,
  topDivider,
  highlighted,
  theme,
  ref,
  onRpe,
  onRemove,
  children,
}: SetStepperFrameProps & {
  labels: SetStepperFrameLabels;
  completed: boolean;
  onRpe: (rpe: number) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  return (
    <View ref={ref} style={[styles.row, topDivider ? styles.divider : null, highlighted ? styles.highlighted : null]}>
      <View style={styles.head}>
        <Txt variant="strong" accessibilityRole="header" accessibilityLabel={labels.titleA11y}>
          {labels.title}
        </Txt>
        {completed ? <Badge label={t('itemEditor.setDone')} tone="success" /> : null}
        <View style={styles.flex} />
        <RowButton
          icon="trash"
          tone="danger"
          label={labels.remove}
          disabled={!canRemove}
          theme={theme}
          onPress={onRemove}
        />
      </View>
      {children}
      <StepperLine label={labels.rpeLabel}>
        <Stepper
          label={labels.rpe}
          value={rpe}
          min={rpeBounds.min}
          max={rpeBounds.max}
          step={1}
          compact
          onChange={onRpe}
        />
      </StepperLine>
    </View>
  );
}
