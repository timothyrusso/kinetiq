import { memo } from 'react';
import { ExerciseThumb, ICON_SIZE, Icon, ListRow, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExercisePickerRowLogic } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.logic';
import { createStyles } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.style';

/**
 * One library result. Memoised with the theme and a shared `onSelect` as props, so typing (which
 * re-renders the sheet on every keystroke) does not re-render two dozen rows whose exercise did
 * not change.
 */
export const ExercisePickerRow = memo(function ExercisePickerRow({
  exercise,
  theme,
  included,
  dimmed,
  onSelect,
}: {
  exercise: Exercise;
  theme: Theme;
  included: boolean;
  dimmed: boolean;
  onSelect: (exerciseId: string) => void;
}) {
  const { derived, effects } = useExercisePickerRowLogic(exercise, onSelect);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <ListRow
      theme={theme}
      title={exercise.name}
      tags={derived.tags}
      tagsMax={2}
      {...(included ? {} : { onPress: effects.select })}
      disabled={included}
      style={dimmed ? [styles.row, styles.dimmed] : styles.row}
      accessibilityHint={t(included ? 'states.alreadyInRoutine' : 'states.addsToRoutine')}
      leading={<ExerciseThumb source={derived.image} name={exercise.name} size={44} theme={theme} />}
      trailing={
        <Icon
          name={included ? 'check' : 'plus'}
          size={ICON_SIZE.inline}
          color={included ? theme.colors.accent : theme.colors.textMuted}
        />
      }
    />
  );
});
