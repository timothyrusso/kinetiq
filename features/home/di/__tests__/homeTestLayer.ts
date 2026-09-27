import { Effect, Layer } from 'effect';
import {
  type Exercise,
  type ExerciseSnapshot,
  ExerciseSnapshotRepository,
  ExercisesLive,
  snapshotOf,
} from '@/features/exercises';
import { aCompletedWorkout, anExercise, aRoutineItem, WORKOUT_TIME } from '@/features/home/__fixtures__/builders';
import { HomeLive } from '@/features/home/di/layer';
import { type Routine, type RoutineItem, RoutineRepository, RoutinesLive } from '@/features/routines';
import { WorkoutRecorder, WorkoutsLive } from '@/features/workouts';

/**
 * The workouts, the routines and the exercises, all real, with the workouts' port onto the
 * routines filled by `home` as the app does: what a home ViewModel test runs over, on
 * `makeTestRuntime`'s migrated in-memory database.
 */
export const HomeTestLayer = WorkoutsLive.pipe(
  Layer.provideMerge(HomeLive),
  Layer.provideMerge(RoutinesLive.pipe(Layer.provideMerge(ExercisesLive))),
);

/** The stored copy of `exercise`, captured at `WORKOUT_TIME`. */
const snapshotFor = (exercise: Exercise): ExerciseSnapshot => snapshotOf(exercise, WORKOUT_TIME);

/**
 * Stores routine `name` with `items`, their exercises' snapshots first, as the builder does, and
 * succeeds with the routine as stored. Item ids are made unique per routine name, since the same
 * builder item goes into several routines.
 */
export const seedRoutine = (name: string, items: readonly RoutineItem[] = [aRoutineItem()]) =>
  Effect.gen(function* () {
    const snapshots = yield* ExerciseSnapshotRepository;
    for (const item of items) {
      yield* snapshots.upsert(snapshotFor(anExercise({ id: item.exerciseId, name: item.exerciseName })));
    }
    const unique = items.map(item => ({ ...item, id: `${item.id}_${name.toLowerCase()}` }));
    return yield* (yield* RoutineRepository).save({ name, items: unique });
  });

/** Counts routine `routine` as trained at `performedAt`. */
export const trainRoutine = (routine: Routine, performedAt: number) =>
  Effect.flatMap(RoutineRepository, repository => repository.markUsed(routine.id, performedAt));

/** Records the builders' finished push day into history, as the watch sync does. */
export const recordWorkout = Effect.flatMap(WorkoutRecorder, recorder => recorder.record(aCompletedWorkout()));
