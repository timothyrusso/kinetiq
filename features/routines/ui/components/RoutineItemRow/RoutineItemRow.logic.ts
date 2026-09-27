import { useCallback, useMemo } from 'react';
import type { Tag } from '@/features/core/design-system';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { itemMeta } from '@/features/routines/mappers/itemMeta';

export interface RoutineItemRowInput {
  readonly item: RoutineItem;
  readonly snapshot: ExerciseSnapshot | null;
  readonly units: UnitSystem;
  readonly index: number;
  readonly onOpen?: (itemId: string) => void;
  readonly onMove?: (from: number, to: number) => void;
  readonly onRemove?: (itemId: string) => void;
}

/**
 * A row's items and tag, built once per item, and its presses, each handing back the row's own id
 * or index to the screen's shared callbacks.
 */
export function useRoutineItemRowLogic({
  item,
  snapshot,
  units,
  index,
  onOpen,
  onMove,
  onRemove,
}: RoutineItemRowInput) {
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
  return {
    derived: { meta, tags, thumbnail: snapshot === null ? null : (snapshot.thumbnailUrl ?? snapshot.imageUrl) },
    effects: { open, up, down, remove },
  };
}
