/**
 * The routine item row and its editor, shared by both routine screens.
 *
 * ## Extracted because two screens would otherwise diverge
 *
 * The builder and the routine screen show the same row, and the difference between them
 * is *actions*, not appearance: a draft can be moved and deleted in memory, a saved item
 * can be moved and deleted through a mutation. Those arrive as optional callbacks, so
 * each screen renders exactly the controls it can perform, and neither owns a private
 * copy of the typography, the thumbnail fallback or the metric rhythm. Two copies of
 * that drift within a week, and the drift is the kind nobody notices until both screens
 * are open on the same routine.
 *
 * ## Reordering is buttons, not a drag
 *
 * Considered and rejected: a drag-to-reorder row. Building one means a pan gesture that
 * does not steal the list's own vertical scroll, a translating row that must not fight
 * FlashList's recycling, and haptics at the right moment: every one of them a class of
 * bug that only surfaces on a device under a real thumb. `ListRow` already forwards
 * `onLongPress`, so the honest long-press menu is available with no gesture code at all.
 * Up/down controls are the same operation, reachable one-handed, work in a screen reader,
 * and cannot mis-fire during a scroll. If a drag earns its keep later it goes here, in
 * one place, and this paragraph is where that decision gets reversed.
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ExerciseThumb, ListRow } from '@/ui/rows';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import type { Theme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import type { UnitSystem } from '@/utils/format';
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import { useT } from '@/i18n/useT';
import type { Tag } from '@/ui/display/types';
import { RowButton } from '@/ui/routineItems/RowButton';
import { itemMeta } from '@/ui/routineItems/itemMeta';

/**
 * One exercise in a routine: thumbnail, name, sets, reps and load as items, the primary muscle
 * as a tag.
 *
 * List discipline, like `rows.tsx`: `theme` arrives as a prop, and every callback takes the
 * item's id or index, so a screen passes the same three functions to every row instead of
 * building a closure per row per render. That is what lets `memo` skip the rows a stepper
 * press did not touch.
 */
export const RoutineItemRow = memo(function RoutineItemRow({
  item,
  snapshot,
  units,
  theme,
  index,
  count,
  onOpen,
  onMove,
  onRemove,
  topDivider = true,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  theme: Theme;
  /** Where the row sits, so the first and last row can disable the impossible move. */
  index: number;
  count: number;
  /** Opens the editor. Absent makes the row inert, which is right for a preview. */
  onOpen?: (itemId: string) => void;
  /** Present in an ordered list; called with this row's index and the one it moves to. */
  onMove?: (from: number, to: number) => void;
  /** Replaces the chevron with a trash control. */
  onRemove?: (itemId: string) => void;
  topDivider?: boolean;
}) {
  const { t } = useT();
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const tags = useMemo<Tag[] | undefined>(
    () =>
      snapshot?.primaryMuscles[0]
        ? [{ key: 'muscle', label: snapshot.primaryMuscles[0] }]
        : undefined,
    [snapshot],
  );
  const open = useCallback(() => onOpen?.(item.id), [onOpen, item.id]);
  const up = useCallback(() => onMove?.(index, index - 1), [onMove, index]);
  const down = useCallback(() => onMove?.(index, index + 1), [onMove, index]);
  const remove = useCallback(() => onRemove?.(item.id), [onRemove, item.id]);

  const row = (
    <ListRow
      theme={theme}
      title={item.exerciseName}
      // The exercise's cue, in full in the editor and on the workout card; one line here.
      {...(item.notes ? { description: item.notes, descriptionLines: 1 } : {})}
      meta={meta}
      {...(tags ? { tags } : {})}
      {...(onOpen === undefined
        ? {}
        : { onPress: open, onLongPress: open, accessibilityHint: t('itemEditor.editHint') })}
      leading={
        <ExerciseThumb
          uri={snapshot === null ? null : (snapshot.thumbnailUrl ?? snapshot.imageUrl)}
          name={item.exerciseName}
          size={44}
          theme={theme}
        />
      }
      trailing={
        <View style={styles.trailing}>
          {onMove ? (
            <>
              <RowButton
                icon="chevronUp"
                label={t('routineItemA11y.moveUp', { name: item.exerciseName })}
                disabled={index === 0}
                theme={theme}
                onPress={up}
              />
              <RowButton
                icon="chevronDown"
                label={t('routineItemA11y.moveDown', { name: item.exerciseName })}
                disabled={index >= count - 1}
                theme={theme}
                onPress={down}
              />
            </>
          ) : null}
          {onRemove ? (
            <RowButton
              icon="trash"
              label={t('routineItemA11y.remove', { name: item.exerciseName })}
              tone="danger"
              theme={theme}
              onPress={remove}
            />
          ) : onMove ? null : (
            <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
          )}
        </View>
      }
    />
  );

  return (
    <View
      style={topDivider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : undefined}
    >
      {onRemove ? (
        <SwipeToDelete theme={theme} onDelete={remove}>
          {row}
        </SwipeToDelete>
      ) : (
        row
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
} satisfies Record<string, ViewStyle>);
