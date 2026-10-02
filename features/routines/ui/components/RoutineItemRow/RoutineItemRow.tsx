import { memo } from 'react';
import { View } from 'react-native';
import { ExerciseThumb, ICON_SIZE, Icon, ListRow, SwipeToDelete, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import {
  type RoutineItemRowInput,
  useRoutineItemRowLogic,
} from '@/features/routines/ui/components/RoutineItemRow/RoutineItemRow.logic';
import { createStyles } from '@/features/routines/ui/components/RoutineItemRow/RoutineItemRow.style';
import { RowButton } from '@/features/routines/ui/components/RowButton/RowButton';

/**
 * One exercise of a routine: thumbnail, name, sets, reps and load, the primary muscle as a tag.
 * The builder and the saved routine draw the same row and differ only in what it can do, so the
 * actions arrive as optional callbacks: each screen renders exactly the controls it can perform.
 *
 * Reordering is up and down buttons, not a drag: the same operation, one-handed, offered to a
 * screen reader as the row's actions, and unable to fire during a scroll. `theme` is a prop and every callback takes
 * the row's id or index, so a screen passes the same functions to every row and `memo` skips the
 * rows a stepper press did not touch.
 */
export const RoutineItemRow = memo(function RoutineItemRow(
  props: RoutineItemRowInput & {
    theme: Theme;
    topDivider?: boolean;
  },
) {
  const { item, theme, index, count, onOpen, onMove, onRemove, topDivider = true } = props;
  const { derived, effects } = useRoutineItemRowLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  const row = (
    <ListRow
      theme={theme}
      title={item.exerciseName}
      {...(item.notes ? { description: item.notes, descriptionLines: 1 } : {})}
      meta={derived.meta}
      {...(derived.tags ? { tags: derived.tags } : {})}
      {...(onOpen === undefined
        ? {}
        : { onPress: effects.open, onLongPress: effects.open, accessibilityHint: t('itemEditor.editHint') })}
      {...(derived.accessibilityActions.length > 0
        ? { accessibilityActions: derived.accessibilityActions, onAccessibilityAction: effects.onAccessibilityAction }
        : {})}
      leading={<ExerciseThumb source={derived.thumbnail} name={item.exerciseName} size={44} theme={theme} />}
      trailing={
        <View style={styles.trailing}>
          {onMove ? (
            <>
              <RowButton
                icon="chevronUp"
                label={t('routineItemA11y.moveUp', { name: item.exerciseName })}
                disabled={index === 0}
                theme={theme}
                onPress={effects.up}
              />
              <RowButton
                icon="chevronDown"
                label={t('routineItemA11y.moveDown', { name: item.exerciseName })}
                disabled={index >= count - 1}
                theme={theme}
                onPress={effects.down}
              />
            </>
          ) : null}
          {onRemove ? (
            <RowButton
              icon="trash"
              label={t('routineItemA11y.remove', { name: item.exerciseName })}
              tone="danger"
              theme={theme}
              onPress={effects.remove}
            />
          ) : onMove ? null : (
            <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
          )}
        </View>
      }
    />
  );

  return (
    <View style={topDivider ? styles.divider : undefined}>
      {onRemove ? (
        <SwipeToDelete theme={theme} onDelete={effects.remove}>
          {row}
        </SwipeToDelete>
      ) : (
        row
      )}
    </View>
  );
});
