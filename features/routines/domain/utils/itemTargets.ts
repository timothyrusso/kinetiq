import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';

/**
 * The opening plan for a newly added exercise: 3 sets of 8-12 at bodyweight, resting for the
 * user's default. A range survives being trained at different efforts on different days without
 * the routine being edited.
 */
export function defaultItemTarget(defaultRestSeconds: number): ItemTarget {
  return { sets: 3, reps: '8-12', weightKg: 0, restSeconds: defaultRestSeconds, notes: null };
}
