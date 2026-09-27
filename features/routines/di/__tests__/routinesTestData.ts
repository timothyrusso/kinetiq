import { Effect } from 'effect';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** A test runtime over `RoutinesTestLayer`, as `renderWithLayer` hands it back. */
interface TestRuntime {
  readonly runPromise: <A, E>(effect: Effect.Effect<A, E, RoutineRepository>) => Promise<A>;
}

/**
 * Counts a workout of routine `id` finished at `performedAt`, as the workouts do on a finish: the
 * seeding a facade test does, kept here because a `facades/` test runs no Effect of its own.
 */
export const markRoutineUsed = (runtime: TestRuntime, id: RoutineId, performedAt: number) =>
  runtime.runPromise(Effect.flatMap(RoutineRepository, repository => repository.markUsed(id, performedAt)));
