import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 3;

export { RoutinesLive } from '@/features/routines/di/layer';
/** What the routine screen needs from the workouts; the tier-4 code that starts a workout provides it. */
export type { WorkoutLauncher } from '@/features/routines/domain/entities/WorkoutLauncher';
/**
 * The repository and its change events, for the higher-tier code that reads every routine or
 * mirrors them (the watch sync, the transfer).
 */
export { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
export { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
export type { Routine, RoutineItem, RoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';
export { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';
/**
 * The opening targets of a new item, and how an item of a type is built and a set changes type,
 * for the tier-4 code that writes a finished workout back into its routine.
 */
export { defaultItemTarget, routineItemOf, routineSetAs } from '@/features/routines/domain/utils/itemTargets';
/** The routines' query keys, for a higher feature that writes routines (the import). */
export { routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
export { useRoutine } from '@/features/routines/facades/useRoutine';
export { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
export { useAddRoutineExercise, useRemoveRoutineItem } from '@/features/routines/facades/useRoutineMutations';
export { useRoutines } from '@/features/routines/facades/useRoutines';
