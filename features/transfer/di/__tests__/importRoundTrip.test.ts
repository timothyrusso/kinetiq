import { readFileSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { itEffect, makeTestAppLayer } from '@/features/core/testing';
import { ExerciseSnapshotRepository, ExercisesLive } from '@/features/exercises';
import { type Routine, RoutineRepository, RoutinesLive } from '@/features/routines';
import { anExerciseSnapshot, EXPORTED_AT, someRoutines } from '@/features/transfer/__fixtures__/builders';
import { routinesJson } from '@/features/transfer/domain/utils/exportDocuments';
import { TransferDeviceFake } from '@/features/transfer/useCases/__tests__/transferFakes';
import { routinesAsWeightReps } from '@/features/transfer/useCases/exportData';
import { readImport } from '@/features/transfer/useCases/readImport';
import { resolveExercisesByName } from '@/features/transfer/useCases/resolveExercisesByName';
import { saveImport } from '@/features/transfer/useCases/saveImport';

const fixture = (name: string) => readFileSync(`${__dirname}/../../__fixtures__/${name}`, 'utf8');

/** What a routine is, apart from what the device gives it: its id, its item ids and its history. */
const planOf = (routine: Routine) => ({
  name: routine.name,
  items: routine.items.map(({ id: _id, ...item }) => item),
});

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const layer = (clipboard: string) =>
  Layer.mergeAll(RoutinesLive, ExercisesLive, TransferDeviceFake({ clipboard })).pipe(
    Layer.provideMerge(makeTestAppLayer().layer),
  );

/** Reads the clipboard, matches every item to a stored exercise and saves; the routines stored after it. */
const importClipboard = Effect.gen(function* () {
  const snapshots = yield* ExerciseSnapshotRepository;
  for (const item of someRoutines().flatMap(routine => routine.items)) {
    yield* snapshots.upsert(anExerciseSnapshot({ exerciseId: item.exerciseId, name: item.exerciseName }));
  }
  const read = yield* readImport('clipboard');
  const resolved = yield* resolveExercisesByName(read?.routines ?? [], 'en');
  const saved = yield* saveImport(resolved, number => `Routine ${number}`, 90);
  expect(saved).toBe(2);
  const routines = yield* (yield* RoutineRepository).list;
  return [...routines].sort(byName);
});

const sets = (count: number, reps: number, weightKg: number) =>
  Array.from({ length: count }, (_, index) => ({ type: 'weightReps', index, reps, weightKg, targetRpe: null }));

describe('importing an exported routines file', () => {
  itEffect(
    'writes a v2 export back byte for byte, every planned set in place',
    Effect.gen(function* () {
      const routines = yield* importClipboard;

      expect(routines.map(planOf)).toEqual(someRoutines().map(planOf).sort(byName));
      expect(routinesJson(routinesAsWeightReps(routines), EXPORTED_AT)).toBe(fixture('kinetiq-routines.json'));
    }),
    layer(fixture('kinetiq-routines.json')),
  );

  itEffect(
    'matches a file from the retired catalog by name, its old ids dropped',
    Effect.gen(function* () {
      const routines = yield* importClipboard;

      expect(routines.map(planOf)).toEqual(someRoutines().map(planOf).sort(byName));
    }),
    layer(fixture('kinetiq-routines.legacy.json')),
  );

  itEffect(
    'reads a v1 export from before per-set routines into identical sets on the bottom of each range',
    Effect.gen(function* () {
      const routines = yield* importClipboard;

      expect(routines.map(planOf)).toEqual([
        {
          name: 'Legs · Heavy',
          items: [
            {
              trackingType: 'weightReps',
              exerciseId: 'ex:barbell-squat',
              exerciseName: 'Squat, Back',
              sets: sets(5, 5, 142.5),
              restSeconds: 180,
              notes: 'Belt on top sets',
            },
            {
              trackingType: 'weightReps',
              exerciseId: 'local:hip-thrust',
              exerciseName: 'Hip thrust',
              sets: sets(3, 10, 60.25),
              restSeconds: 90,
              notes: null,
            },
          ],
        },
        {
          name: 'Push Day',
          items: [
            {
              trackingType: 'weightReps',
              exerciseId: 'ex:barbell-bench-press-medium-grip',
              exerciseName: 'Bench Press',
              sets: sets(3, 8, 60),
              restSeconds: 90,
              notes: null,
            },
            {
              trackingType: 'weightReps',
              exerciseId: 'ex:barbell-shoulder-press',
              exerciseName: 'Overhead Press',
              sets: sets(4, 6, 40),
              restSeconds: 60,
              notes: 'Brace first',
            },
          ],
        },
      ]);
    }),
    layer(fixture('kinetiq-routines.v1.json')),
  );
});
