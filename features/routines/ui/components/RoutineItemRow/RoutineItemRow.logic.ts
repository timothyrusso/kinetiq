import { useCallback, useMemo } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';
import type { Tag } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { itemMeta } from '@/features/routines/mappers/itemMeta';

export interface RoutineItemRowInput {
  readonly item: RoutineItem;
  readonly snapshot: ExerciseSnapshot | null;
  readonly units: UnitSystem;
  readonly index: number;
  /** Where the row sits, so the first and last rows disable the impossible move. */
  readonly count: number;
  readonly onOpen?: (itemId: string) => void;
  readonly onMove?: (from: number, to: number) => void;
  readonly onRemove?: (itemId: string) => void;
}

/**
 * A row's items and tag, built once per item, and its presses, each handing back the row's own id
 * or index to the screen's shared callbacks.
 *
 * The move and remove buttons are also the row's accessibility actions: the row is one accessible
 * element, so VoiceOver and TalkBack reach its buttons through the actions menu rather than as
 * children. A move the row cannot make is left out, as its button is disabled.
 */
export function useRoutineItemRowLogic({
  item,
  snapshot,
  units,
  index,
  count,
  onOpen,
  onMove,
  onRemove,
}: RoutineItemRowInput) {
  const { t } = useT();
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const muscle = snapshot?.primaryMuscles[0];
  const tags = useMemo<Tag[] | undefined>(
    () => (muscle === undefined ? undefined : [{ key: 'muscle', label: muscle }]),
    [muscle],
  );
  const open = useCallback(() => onOpen?.(item.id), [onOpen, item.id]);
  const up = useCallback(() => onMove?.(index, index - 1), [onMove, index]);
  const down = useCallback(() => onMove?.(index, index + 1), [onMove, index]);
  const remove = useCallback(() => onRemove?.(item.id), [onRemove, item.id]);

  const name = item.exerciseName;
  const canMove = onMove !== undefined;
  const canRemove = onRemove !== undefined;
  const actions = useMemo<AccessibilityActionInfo[]>(
    () => [
      ...(canMove && index > 0 ? [{ name: 'moveUp', label: t('routineItemA11y.moveUp', { name }) }] : []),
      ...(canMove && index < count - 1 ? [{ name: 'moveDown', label: t('routineItemA11y.moveDown', { name }) }] : []),
      ...(canRemove ? [{ name: 'remove', label: t('routineItemA11y.remove', { name }) }] : []),
    ],
    [canMove, canRemove, count, index, name, t],
  );
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === 'moveUp') up();
      else if (action === 'moveDown') down();
      else if (action === 'remove') remove();
    },
    [down, remove, up],
  );

  return {
    derived: {
      meta,
      tags,
      thumbnail: snapshot === null ? null : (snapshot.thumbnailUrl ?? snapshot.imageUrl),
      accessibilityActions: actions,
    },
    effects: { open, up, down, remove, onAccessibilityAction: onAction },
  };
}
