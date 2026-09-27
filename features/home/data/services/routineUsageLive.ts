import { Effect, Layer } from 'effect';
import { RoutineId, RoutineRepository } from '@/features/routines';
import { RoutineUsage } from '@/features/workouts';

/**
 * `workouts`' port onto the routines: a recorded workout counts against its routine through the
 * routines' own repository, which also announces the change. Here, above both, because the two
 * features are peers and neither may import the other.
 */
export const RoutineUsageLive = Layer.effect(
  RoutineUsage,
  Effect.map(RoutineRepository, routines => ({
    markUsed: (routineId: string, performedAt: number) => routines.markUsed(RoutineId.make(routineId), performedAt),
  })),
);
