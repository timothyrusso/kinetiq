import { Effect } from 'effect';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';

/** The stored copy of exercise `id`, or null when no routine or session has stored it. */
export const getStoredExercise = (id: string) =>
  Effect.gen(function* () {
    const snapshot = yield* (yield* ExerciseSnapshotRepository).byId(id);
    return snapshot ?? null;
  });
