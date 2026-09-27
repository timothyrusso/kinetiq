import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * The routine's item ids in the order `orderedItemIds` asks for. An id the routine does not have
 * is ignored and an item the list leaves out keeps its place relative to the other left-out
 * items, after the ones named: a reorder sent against a list that changed underneath it can move
 * rows, never lose or invent one.
 */
export function orderedItemIds(items: readonly RoutineItem[], orderedIds: readonly string[]): string[] {
  const remaining = new Set(items.map(item => item.id));
  const ordered: string[] = [];
  for (const id of orderedIds) {
    if (!remaining.delete(id)) continue;
    ordered.push(id);
  }
  return [...ordered, ...items.map(item => item.id).filter(id => remaining.has(id))];
}
