import { readFileSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { itEffect, makeTestAppLayer } from '@/features/core/testing';
import { ExerciseSnapshotRepository, ExercisesLive } from '@/features/exercises';
import { type Routine, RoutineRepository, RoutinesLive } from '@/features/routines';
import { anExerciseSnapshot, someRoutines } from '@/features/transfer/__fixtures__/builders';
import { TransferDeviceFake } from '@/features/transfer/useCases/__tests__/transferFakes';
import { readImport } from '@/features/transfer/useCases/readImport';
import { resolveExercisesByName } from '@/features/transfer/useCases/resolveExercisesByName';
import { saveImport } from '@/features/transfer/useCases/saveImport';

const exported = readFileSync(`${__dirname}/../../__fixtures__/kinetiq-routines.json`, 'utf8');

/** What a routine is, apart from what the device gives it: its id, its item ids and its history. */
const planOf = (routine: Routine) => ({
  name: routine.name,
  items: routine.items.map(({ id: _id, ...item }) => item),
});

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const layer = Layer.mergeAll(RoutinesLive, ExercisesLive, TransferDeviceFake({ clipboard: exported })).pipe(
  Layer.provideMerge(makeTestAppLayer().layer),
);

describe('importing an exported routines file', () => {
  itEffect(
    'writes the same routines with the same items, targets and order it was exported from',
    Effect.gen(function* () {
      const snapshots = yield* ExerciseSnapshotRepository;
      for (const item of someRoutines().flatMap(routine => routine.items)) {
        const externalId = item.exerciseId.startsWith('wger:') ? Number(item.exerciseId.slice(5)) : null;
        yield* snapshots.upsert(
          anExerciseSnapshot({ exerciseId: item.exerciseId, name: item.exerciseName, externalId }),
        );
      }

      const read = yield* readImport('clipboard');
      const resolved = yield* resolveExercisesByName(read?.routines ?? [], 'en');
      const saved = yield* saveImport(resolved, number => `Routine ${number}`, 90);

      expect(saved).toBe(2);
      const routines = yield* (yield* RoutineRepository).list;
      expect(routines.map(planOf).sort(byName)).toEqual(someRoutines().map(planOf).sort(byName));
    }),
    layer,
  );
});
