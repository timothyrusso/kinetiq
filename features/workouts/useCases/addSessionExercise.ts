import { Clock, Effect } from 'effect';
import { type Exercise, ExerciseSnapshotRepository, snapshotOf } from '@/features/exercises';
import type { SessionPlanItem } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import { entryFromPlanItem } from '@/features/workouts/domain/utils/sessionPlan';

/** The targets an exercise added mid-workout opens with. */
export type ExerciseTarget = Omit<SessionPlanItem, 'exerciseId' | 'exerciseName'>;

/**
 * The entry for `exercise`, added to a workout in progress, after freezing the exercise into the
 * stored snapshots. The freeze is what keeps the recorded workout readable once the catalog
 * drops the exercise, so it lands before the entry exists, and its failure is this one's. The
 * entry is built like a planned one, so a row added mid-workout cannot come out shaped
 * differently: same rep parsing, same set numbering.
 */
export const addSessionExercise = (exercise: Exercise, target: ExerciseTarget) =>
  Effect.gen(function* () {
    const snapshots = yield* ExerciseSnapshotRepository;
    yield* snapshots.upsert(snapshotOf(exercise, yield* Clock.currentTimeMillis));
    return entryFromPlanItem({ exerciseId: exercise.id, exerciseName: exercise.name, ...target });
  });
