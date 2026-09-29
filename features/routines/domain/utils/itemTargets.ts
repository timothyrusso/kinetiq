import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';

const DEFAULT_REPS = 8;

/** `count` sets of `reps` at `weightKg`, numbered from 0, with no effort target. */
export function uniformSets(count: number, reps: number, weightKg: number): RoutineSet[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({ index, reps, weightKg, targetRpe: null }));
}

/**
 * `sets` cut or grown to `count` (at least one): a set added copies the last one, so a longer
 * item keeps the load it had.
 */
export function resizeSets(sets: readonly RoutineSet[], count: number): RoutineSet[] {
  const target = Math.max(1, count);
  const last = sets.at(-1) ?? { index: 0, reps: DEFAULT_REPS, weightKg: 0, targetRpe: null };
  return Array.from({ length: target }, (_, index) => ({ ...(sets[index] ?? last), index }));
}

/** `sets` with `patch` applied to the set at `index` only. */
export function withSet(
  sets: readonly RoutineSet[],
  index: number,
  patch: Partial<Omit<RoutineSet, 'index'>>,
): RoutineSet[] {
  return sets.map(set => (set.index === index ? { ...set, ...patch } : set));
}

/** `sets` without the set at `index`, renumbered from 0; the last set stays. */
export function removeSet(sets: readonly RoutineSet[], index: number): RoutineSet[] {
  if (sets.length <= 1) return [...sets];
  return sets.filter(set => set.index !== index).map((set, at) => (set.index === at ? set : { ...set, index: at }));
}

/**
 * The opening plan for a newly added exercise: 3 sets of 8 at bodyweight, resting for the user's
 * default.
 */
export function defaultItemTarget(defaultRestSeconds: number): ItemTarget {
  return { sets: uniformSets(3, DEFAULT_REPS, 0), restSeconds: defaultRestSeconds, notes: null };
}
