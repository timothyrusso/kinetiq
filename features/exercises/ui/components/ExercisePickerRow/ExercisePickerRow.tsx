import { memo } from 'react';
import { View } from 'react-native';
import { ExerciseThumb, ICON_SIZE, Icon, ListRow, RowButton, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExercisePickerRowLogic } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.logic';
import { createStyles } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.style';

/**
 * One library result. Memoised with the theme and the shared `onSelect` and `onInfo` as props, so
 * typing (which re-renders the sheet on every keystroke) does not re-render two dozen rows whose
 * exercise did not change. The info button stays live on an included row: an exercise already in
 * the routine is still one to read about.
 *
 * A `removable` included row is selected rather than disabled: tinted, filled check, and a tap
 * hands its id to the same `onSelect`, which removes it. Without `removable` (the live workout)
 * an included row is inert.
 */
export const ExercisePickerRow = memo(function ExercisePickerRow({
  exercise,
  theme,
  included,
  removable,
  dimmed,
  onSelect,
  onInfo,
}: {
  exercise: Exercise;
  theme: Theme;
  included: boolean;
  removable: boolean;
  dimmed: boolean;
  onSelect: (exerciseId: string) => void;
  onInfo: (exerciseId: string) => void;
}) {
  const { derived, effects } = useExercisePickerRowLogic(exercise, onSelect, onInfo);
  const { t } = useT();
  const styles = useStyles(createStyles);
  const selected = included && removable;
  const inert = included && !removable;

  return (
    <ListRow
      theme={theme}
      title={exercise.name}
      tags={derived.tags}
      tagsMax={2}
      {...(inert ? {} : { onPress: effects.select })}
      disabled={inert}
      selected={selected}
      style={dimmed ? [styles.row, styles.dimmed] : styles.row}
      accessibilityHint={t(
        selected ? 'states.removesFromRoutine' : inert ? 'states.alreadyInRoutine' : 'states.addsToRoutine',
      )}
      accessibilityActions={derived.accessibilityActions}
      onAccessibilityAction={effects.onAccessibilityAction}
      leading={<ExerciseThumb source={derived.image} name={exercise.name} size={44} theme={theme} />}
      trailing={
        <View style={styles.trailing}>
          <RowButton icon="info" label={derived.infoLabel} theme={theme} onPress={effects.info} />
          <Icon
            name={selected ? 'checkCircle' : included ? 'check' : 'plus'}
            size={ICON_SIZE.inline}
            color={included ? theme.colors.accent : theme.colors.textMuted}
          />
        </View>
      }
    />
  );
});
