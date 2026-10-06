import { Clock, Effect } from 'effect';
import { defaultTrackingType, type Exercise, ExerciseSnapshotRepository, snapshotOf } from '@/features/exercises';
import { entryOf, newSet } from '@/features/workouts/domain/utils/trackingSets';

/**
 * What an exercise added mid-workout opens with besides its sets' values: how many sets, its rest
 * and its cue. The values come from the exercise's tracking type.
 */
export interface ExerciseTarget {
  readonly setCount: number;
  readonly restSeconds: number;
  readonly notes: string | null;
}

/**
 * The entry for `exercise`, added to a workout in progress, after freezing the exercise into the
 * stored snapshots. The freeze is what keeps the recorded workout readable once the catalog
 * drops the exercise, so it lands before the entry exists, and its failure is this one's. The
 * entry records the exercise's default tracking type, each set on that type's defaults (8 reps at
 * bodyweight, 8 reps, or 30 s), and opens with at least one set.
 */
export const addSessionExercise = (exercise: Exercise, target: ExerciseTarget) =>
  Effect.gen(function* () {
    const snapshots = yield* ExerciseSnapshotRepository;
    yield* snapshots.upsert(snapshotOf(exercise, yield* Clock.currentTimeMillis));
    const type = defaultTrackingType(exercise);
    const sets = Array.from({ length: Math.max(1, target.setCount) }, (_, index) => newSet(type, index));
    return entryOf(
      {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: null,
        restSeconds: target.restSeconds,
        notes: target.notes,
      },
      type,
      sets,
    );
  });
