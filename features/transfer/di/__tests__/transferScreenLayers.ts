import { Effect, Layer } from 'effect';
import { SqlError, UnexpectedError } from '@/features/core/error';
import { ExerciseSnapshotRepository, ExercisesLive } from '@/features/exercises';
import { type Routine, RoutineRepository, RoutinesLive } from '@/features/routines';
import { anExercise, anExerciseSnapshot, someActivities } from '@/features/transfer/__fixtures__/builders';
import type { ExportFile } from '@/features/transfer/domain/entities/TransferFormat';
import { ImportTooLarge } from '@/features/transfer/domain/errors/TransferErrors';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';
import {
  ActivityRepositoryFake,
  ExerciseCatalogFake,
  ExerciseSnapshotRepositoryFake,
  RoutineRepositoryFake,
} from '@/features/transfer/useCases/__tests__/transferFakes';

/** The device as the data screen leaves it: what went to the share sheet and what is on the clipboard. */
interface TransferScreenDevice {
  clipboard: string;
  picked: string | null;
  pickedTooLarge: boolean;
  refuseShare: boolean;
  shared: ExportFile[];
}

/**
 * The data screen's services: the real routines and exercises on the test database, the fixture
 * history, and a device whose clipboard, picker and share sheet the test sets and reads back.
 * `reset` empties the device before a test.
 */
export const makeDataScreenLayer = () => {
  const device: TransferScreenDevice = {
    clipboard: '',
    picked: null,
    pickedTooLarge: false,
    refuseShare: false,
    shared: [],
  };
  const deviceLayer = Layer.succeed(TransferDevice, {
    share: file =>
      device.refuseShare
        ? Effect.fail(new UnexpectedError({ cause: 'no share sheet' }))
        : Effect.sync(() => void device.shared.push(file)),
    readClipboard: Effect.sync(() => device.clipboard),
    copyToClipboard: text =>
      Effect.sync(() => {
        device.clipboard = text;
      }),
    pickFile: () => (device.pickedTooLarge ? Effect.fail(new ImportTooLarge()) : Effect.succeed(device.picked)),
  });
  const reset = () => {
    device.clipboard = '';
    device.picked = null;
    device.pickedTooLarge = false;
    device.refuseShare = false;
    device.shared = [];
  };
  const layer = () =>
    Layer.mergeAll(RoutinesLive, ExercisesLive, ActivityRepositoryFake(someActivities()), deviceLayer);
  return { layer, device, reset };
};

/** The squat as the catalog reads it: what a loose "Squat" finds. */
const SQUAT = anExercise({ id: 'wger:111', name: 'Squat, Back', externalId: 111 });

const unused = () => Effect.die(new Error('not used by the import'));

/**
 * The import preview's services: the bench press stored on the device, a catalog holding the
 * squat, and the routines written into `saved`. `snapshotsFail` fails every stored lookup,
 * `saveFails` every routine write.
 */
export const importScreenLayer = (
  saved: Routine[],
  options: { readonly snapshotsFail?: boolean; readonly saveFails?: boolean } = {},
) =>
  Layer.mergeAll(
    options.saveFails
      ? Layer.succeed(RoutineRepository, {
          list: Effect.succeed([]),
          byId: () => Effect.succeed(undefined),
          save: () => Effect.fail(new SqlError({ message: 'save a routine' })),
          rename: unused,
          delete: unused,
          reorder: unused,
          setItem: unused,
          addItem: unused,
          removeItem: unused,
          markUsed: unused,
          replaceItems: unused,
        })
      : RoutineRepositoryFake(saved),
    options.snapshotsFail
      ? Layer.succeed(ExerciseSnapshotRepository, {
          byId: () => Effect.fail(new SqlError({ message: 'read a snapshot' })),
          byIds: () => Effect.fail(new SqlError({ message: 'read snapshots' })),
          byName: () => Effect.fail(new SqlError({ message: 'read a snapshot' })),
          upsert: unused,
        })
      : ExerciseSnapshotRepositoryFake(new Map([['wger:73', anExerciseSnapshot()]])),
    ExerciseCatalogFake([SQUAT]),
  );
