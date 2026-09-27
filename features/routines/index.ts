import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 3;

export { RoutinesLive } from '@/features/routines/di/layer';
/** @public The change `RoutineEvents` publishes, for the tier-4 code that mirrors the routines (watch-sync, #54). */
export type { RoutineChanged, RoutineChangeKind } from '@/features/routines/domain/entities/RoutineChanged';
/**
 * The repository and its change events, for the higher-tier code that reads every routine or
 * mirrors them (the watch sync, the transfer).
 */
export { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
export { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
export type { Routine, RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
export { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';
export { defaultItemTarget } from '@/features/routines/domain/utils/itemTargets';
export { useRoutine } from '@/features/routines/facades/useRoutine';
export { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
export { useAddRoutineExercise } from '@/features/routines/facades/useRoutineMutations';
export { useRoutines } from '@/features/routines/facades/useRoutines';
