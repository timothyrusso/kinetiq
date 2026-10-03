import { Effect, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aRoutineItem } from '@/features/home/__fixtures__/builders';
import { applyWorkoutToRoutine } from '@/features/home/useCases/applyWorkoutToRoutine';
import { type Routine, RoutineId, type RoutineItem, RoutineRepository, type RoutineSet } from '@/features/routines';
import type { RoutineUpdate, StrengthEntry } from '@/features/workouts';

type WorkoutSet = StrengthEntry['sets'][number];

const PUSH = RoutineId.make('rtn_push');

const row = (index: number, reps: number, weightKg: number, targetRpe: number | null = null): RoutineSet => ({
  index,
  reps,
  weightKg,
  targetRpe,
});

const BENCH = aRoutineItem({ sets: [row(0, 8, 60), row(1, 8, 60), row(2, 8, 60)] });
const PRESS = aRoutineItem({
  id: 'rit_press',
  exerciseId: 'ex:barbell-squat',
  exerciseName: 'Overhead Press',
  sets: [row(0, 6, 40, 8), row(1, 6, 40, 8)],
  restSeconds: 60,
  notes: 'Brace first',
});
const DIPS = aRoutineItem({
  id: 'rit_dips',
  exerciseId: 'ex:dips',
  exerciseName: 'Dips',
  sets: [row(0, 10, 0), row(1, 10, 0)],
});

const aPushDay = (items: readonly RoutineItem[] = [BENCH, PRESS, DIPS]): Routine => ({
  id: PUSH,
  name: 'Push Day',
  items,
  createdAt: 0,
  updatedAt: 0,
  timesCompleted: 0,
  lastPerformedAt: null,
});

/** A set of the workout, planned from row `routineSetIndex` unless it was added during it. */
const set = (
  index: number,
  values: { reps: number; weightKg: number; rpe?: number | null; completed?: boolean; routineSetIndex?: number },
): WorkoutSet => ({
  index,
  reps: values.reps,
  weightKg: values.weightKg,
  completed: values.completed ?? true,
  estimated1rm: null,
  rpe: values.rpe ?? null,
  ...(values.routineSetIndex !== undefined ? { routineSetIndex: values.routineSetIndex } : {}),
});

/** The entry a routine item opens with, every set still open on its row's values. */
const openedFrom = (item: RoutineItem): StrengthEntry => ({
  exerciseId: item.exerciseId,
  exerciseName: item.exerciseName,
  muscleGroup: null,
  sets: item.sets.map(planned =>
    set(planned.index, {
      reps: planned.reps,
      weightKg: planned.weightKg,
      rpe: planned.targetRpe,
      completed: false,
      routineSetIndex: planned.index,
    }),
  ),
  notes: item.notes,
  restSeconds: item.restSeconds,
  routineItemId: item.id,
});

const withSets = (entry: StrengthEntry, sets: readonly WorkoutSet[]): StrengthEntry => ({ ...entry, sets });

const updateOf = (entries: readonly StrengthEntry[], plannedItemIds = ['rit_bench', 'rit_press', 'rit_dips']) => {
  const update: RoutineUpdate = { routineId: PUSH, plannedItemIds, entries };
  return update;
};

/** The routines on the device, and every `replaceItems` the use case made. */
interface Stored {
  routine: Routine | undefined;
  writes: (readonly RoutineItem[])[];
}

const unused = () => Effect.die(new Error('not used by the write-back'));

const routinesOver = (stored: Stored) =>
  Layer.succeed(RoutineRepository, {
    list: unused(),
    byId: id => Effect.sync(() => (stored.routine?.id === id ? stored.routine : undefined)),
    save: unused,
    rename: unused,
    delete: unused,
    reorder: unused,
    setItem: unused,
    addItem: unused,
    removeItem: unused,
    markUsed: unused,
    replaceItems: (_id, items) =>
      Effect.sync(() => {
        stored.writes.push(items);
      }),
  });

const storing = (routine: Routine | undefined = aPushDay()): Stored => ({ routine, writes: [] });

const lastWrite = (stored: Stored) => stored.writes.at(-1) ?? [];

describe('applyWorkoutToRoutine', () => {
  const completed = storing();
  itEffect(
    'writes each done set’s reps, weight and RPE, as the target, to the row at the same index',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [
        set(0, { reps: 10, weightKg: 62.5, rpe: 7, routineSetIndex: 0 }),
        set(1, { reps: 8, weightKg: 65, rpe: 8.5, routineSetIndex: 1 }),
        set(2, { reps: 6, weightKg: 67.5, routineSetIndex: 2 }),
      ]);

      yield* applyWorkoutToRoutine(updateOf([bench, openedFrom(PRESS), openedFrom(DIPS)]));

      expect(lastWrite(completed)[0]?.sets).toEqual([row(0, 10, 62.5, 7), row(1, 8, 65, 8.5), row(2, 6, 67.5)]);
    }),
    routinesOver(completed),
  );

  const skipped = storing();
  itEffect(
    'keeps the routine’s values for a set that was not done, even one edited and left open',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [
        set(0, { reps: 10, weightKg: 70, routineSetIndex: 0 }),
        set(1, { reps: 3, weightKg: 100, completed: false, routineSetIndex: 1 }),
        set(2, { reps: 8, weightKg: 60, completed: false, routineSetIndex: 2 }),
      ]);

      yield* applyWorkoutToRoutine(updateOf([bench, openedFrom(PRESS), openedFrom(DIPS)]));

      expect(lastWrite(skipped)[0]?.sets).toEqual([row(0, 10, 70), row(1, 8, 60), row(2, 8, 60)]);
    }),
    routinesOver(skipped),
  );

  const addedSets = storing();
  itEffect(
    'adds a set added during the workout and done, and not one left open',
    Effect.gen(function* () {
      const press = withSets(openedFrom(PRESS), [
        set(0, { reps: 6, weightKg: 40, rpe: 8, routineSetIndex: 0 }),
        set(1, { reps: 6, weightKg: 40, rpe: 8, routineSetIndex: 1 }),
        set(2, { reps: 5, weightKg: 42.5, rpe: 9 }),
        set(3, { reps: 5, weightKg: 42.5, completed: false }),
      ]);

      yield* applyWorkoutToRoutine(updateOf([openedFrom(BENCH), press, openedFrom(DIPS)]));

      expect(lastWrite(addedSets)[1]?.sets).toEqual([row(0, 6, 40, 8), row(1, 6, 40, 8), row(2, 5, 42.5, 9)]);
    }),
    routinesOver(addedSets),
  );

  const removedSets = storing();
  itEffect(
    'removes a set removed during the workout, and a later open set keeps its own row',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [
        set(0, { reps: 8, weightKg: 70, routineSetIndex: 0 }),
        set(1, { reps: 5, weightKg: 60, completed: false, routineSetIndex: 2 }),
      ]);
      const routine = aPushDay([aRoutineItem({ sets: [row(0, 8, 60), row(1, 8, 60), row(2, 5, 55)] }), PRESS, DIPS]);
      removedSets.routine = routine;

      yield* applyWorkoutToRoutine(updateOf([bench, openedFrom(PRESS), openedFrom(DIPS)]));

      expect(lastWrite(removedSets)[0]?.sets).toEqual([row(0, 8, 70), row(1, 5, 55)]);
    }),
    routinesOver(removedSets),
  );

  const skippedExercise = storing();
  itEffect(
    'leaves an exercise with no done set as the routine has it, whatever was changed on it',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [set(0, { reps: 8, weightKg: 70, rpe: 7, routineSetIndex: 0 })]);
      const press = withSets(openedFrom(PRESS), [
        set(0, { reps: 20, weightKg: 10, completed: false, routineSetIndex: 0 }),
        set(1, { reps: 20, weightKg: 10, completed: false }),
      ]);

      yield* applyWorkoutToRoutine(updateOf([bench, press, openedFrom(DIPS)]));

      expect(lastWrite(skippedExercise)[1]).toEqual(PRESS);
      expect(lastWrite(skippedExercise)[2]).toEqual(DIPS);
    }),
    routinesOver(skippedExercise),
  );

  const addedExercise = storing();
  itEffect(
    'adds an exercise added during the workout with its done sets, its rest and no note, and not one never done',
    Effect.gen(function* () {
      const flyes: StrengthEntry = {
        exerciseId: 'ex:incline-bench-press',
        exerciseName: 'Cable Flyes',
        muscleGroup: null,
        sets: [
          set(0, { reps: 12, weightKg: 15, rpe: 8 }),
          set(1, { reps: 12, weightKg: 15, completed: false }),
          set(2, { reps: 10, weightKg: 17.5 }),
        ],
        notes: 'Squeeze',
        restSeconds: 75,
      };
      const curls: StrengthEntry = {
        ...flyes,
        exerciseId: 'ex:overhead-press',
        exerciseName: 'Curls',
        sets: [set(0, { reps: 10, weightKg: 12, completed: false })],
      };

      yield* applyWorkoutToRoutine(updateOf([openedFrom(BENCH), openedFrom(PRESS), openedFrom(DIPS), flyes, curls]));

      const items = lastWrite(addedExercise);
      expect(items).toHaveLength(4);
      expect(items[3]).toMatchObject({
        exerciseId: 'ex:incline-bench-press',
        exerciseName: 'Cable Flyes',
        sets: [row(0, 12, 15, 8), row(1, 10, 17.5)],
        restSeconds: 75,
        notes: null,
      });
      expect(items[3]?.id).toMatch(/^rit_/);
    }),
    routinesOver(addedExercise),
  );

  const removedExercise = storing();
  itEffect(
    'removes an exercise removed during the workout',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [set(0, { reps: 8, weightKg: 60, routineSetIndex: 0 })]);

      yield* applyWorkoutToRoutine(updateOf([bench, openedFrom(DIPS)]));

      expect(lastWrite(removedExercise).map(item => item.id)).toEqual(['rit_bench', 'rit_dips']);
    }),
    routinesOver(removedExercise),
  );

  const reordered = storing();
  itEffect(
    'takes the workout’s exercise order as the routine’s',
    Effect.gen(function* () {
      yield* applyWorkoutToRoutine(updateOf([openedFrom(DIPS), openedFrom(BENCH), openedFrom(PRESS)]));

      expect(lastWrite(reordered).map(item => item.id)).toEqual(['rit_dips', 'rit_bench', 'rit_press']);
    }),
    routinesOver(reordered),
  );

  const editedMeanwhile = storing(
    aPushDay([BENCH, DIPS, aRoutineItem({ id: 'rit_row', exerciseId: 'ex:bent-over-row' })]),
  );
  itEffect(
    'never brings back an exercise removed from the routine during the workout, and keeps one added meanwhile',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [set(0, { reps: 9, weightKg: 60, routineSetIndex: 0 })]);
      const press = withSets(openedFrom(PRESS), [set(0, { reps: 6, weightKg: 45, routineSetIndex: 0 })]);

      yield* applyWorkoutToRoutine(updateOf([bench, press, openedFrom(DIPS)]));

      expect(lastWrite(editedMeanwhile).map(item => item.id)).toEqual(['rit_bench', 'rit_dips', 'rit_row']);
    }),
    routinesOver(editedMeanwhile),
  );

  const restAndNotes = storing();
  itEffect(
    'never writes rest or notes',
    Effect.gen(function* () {
      const press = {
        ...withSets(openedFrom(PRESS), [set(0, { reps: 6, weightKg: 45, routineSetIndex: 0 })]),
        restSeconds: 180,
        notes: 'Something else',
      };

      yield* applyWorkoutToRoutine(updateOf([openedFrom(BENCH), press, openedFrom(DIPS)]));

      expect(lastWrite(restAndNotes)[1]).toMatchObject({ restSeconds: 60, notes: 'Brace first' });
    }),
    routinesOver(restAndNotes),
  );

  const untouched = storing();
  itEffect(
    'writes nothing when the workout leaves the routine as it is',
    Effect.gen(function* () {
      yield* applyWorkoutToRoutine(updateOf([openedFrom(BENCH), openedFrom(PRESS), openedFrom(DIPS)]));

      expect(untouched.writes).toEqual([]);
    }),
    routinesOver(untouched),
  );

  const emptied = storing();
  itEffect(
    'writes nothing when every exercise was removed during the workout, rather than empty the routine',
    Effect.gen(function* () {
      yield* applyWorkoutToRoutine(updateOf([]));

      expect(emptied.writes).toEqual([]);
    }),
    routinesOver(emptied),
  );

  const deleted: Stored = { routine: undefined, writes: [] };
  itEffect(
    'writes nothing into a routine deleted during the workout',
    Effect.gen(function* () {
      const bench = withSets(openedFrom(BENCH), [set(0, { reps: 9, weightKg: 60, routineSetIndex: 0 })]);

      yield* applyWorkoutToRoutine(updateOf([bench]));

      expect(deleted.writes).toEqual([]);
    }),
    routinesOver(deleted),
  );
});
