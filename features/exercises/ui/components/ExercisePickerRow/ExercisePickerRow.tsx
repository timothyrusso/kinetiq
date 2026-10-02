import { memo } from 'react';
import { View } from 'react-native';
import { ExerciseThumb, ICON_SIZE, Icon, ListRow, RowButton, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExercisePickerRowLogic } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.logic';
import { createStyles } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.style';
import type { PickDestination } from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

/**
 * One library result. Memoised with the theme and the shared `onSelect` and `onInfo` as props, so
 * typing (which re-renders the sheet on every keystroke) does not re-render two dozen rows whose
 * exercise did not change. The info button stays live on an included row: an exercise already in
 * the routine is still one to read about.
 *
 * A `removable` included row is selected rather than disabled: tinted, filled check, and a tap
 * hands its id to the same `onSelect`, which removes it. Without `removable`, or with a `locked`
 * reason (a workout's exercise with a logged set, or its last one), an included row is inert, and
 * a reason is shown under the name and read as its hint.
 */
export const ExercisePickerRow = memo(function ExercisePickerRow({
  exercise,
  theme,
  included,
  removable,
  locked,
  destination,
  dimmed,
  onSelect,
  onInfo,
}: {
  exercise: Exercise;
  theme: Theme;
  included: boolean;
  removable: boolean;
  locked: string | null;
  destination: PickDestination;
  dimmed: boolean;
  onSelect: (exerciseId: string) => void;
  onInfo: (exerciseId: string) => void;
}) {
  const { derived, effects } = useExercisePickerRowLogic(exercise, onSelect, onInfo, {
    included,
    removable,
    locked,
    destination,
  });
  const styles = useStyles(createStyles);
  const { selected, inert } = derived;

  return (
    <ListRow
      theme={theme}
      title={exercise.name}
      tags={derived.tags}
      tagsMax={2}
      {...(locked === null ? {} : { description: locked })}
      {...(inert ? {} : { onPress: effects.select })}
      disabled={inert}
      selected={selected}
      style={dimmed ? [styles.row, styles.dimmed] : styles.row}
      accessibilityHint={derived.hint}
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
