import { Effect, Layer } from 'effect';
import { type SqlError, UnexpectedError } from '@/features/core/error';
import {
  type Exercise,
  ExerciseCatalog,
  type ExerciseSnapshot,
  ExerciseSnapshotRepository,
} from '@/features/exercises';
import { type Routine, RoutineId, RoutineRepository } from '@/features/routines';
import type { ExportFile } from '@/features/transfer/domain/entities/TransferFormat';
import { ImportTooLarge } from '@/features/transfer/domain/errors/TransferErrors';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';
import { type Activity, ActivityRepository } from '@/features/workouts';

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const unused = () => Effect.die(new Error('not used by the transfer'));

/** The device, with a clipboard holding `clipboard` and a picker that returns `picked`. */
export const TransferDeviceFake = (options: {
  readonly clipboard?: string | Error;
  readonly picked?: { readonly text: string | null; readonly bytes?: number };
  readonly shared?: ExportFile[];
  readonly copied?: string[];
}) =>
  Layer.succeed(TransferDevice, {
    share: file => Effect.sync(() => void options.shared?.push(file)),
    readClipboard:
      options.clipboard instanceof Error
        ? Effect.fail(new UnexpectedError({ cause: options.clipboard }))
        : Effect.succeed(options.clipboard ?? ''),
    copyToClipboard: text => Effect.sync(() => void options.copied?.push(text)),
    pickFile: maxBytes => {
      const picked = options.picked ?? { text: null };
      if ((picked.bytes ?? 0) > maxBytes) return Effect.fail(new ImportTooLarge());
      return Effect.succeed(picked.text);
    },
  });

/** The history, oldest first, as `list({ order: 'asc' })` reads it. */
export const ActivityRepositoryFake = (activities: readonly Activity[]) =>
  Layer.succeed(ActivityRepository, {
    list: () => Effect.succeed(activities),
    byId: id => Effect.succeed(activities.find(activity => activity.id === id)),
    count: Effect.succeed(activities.length),
    remove: unused,
    recordWorkout: unused,
  });

/** The routines on the device: `list`, and `save`, which keeps what it was given. */
export const RoutineRepositoryFake = (routines: Routine[] = []) =>
  Layer.succeed(RoutineRepository, {
    list: Effect.sync(() => [...routines]),
    byId: id => Effect.sync(() => routines.find(routine => routine.id === id)),
    save: input =>
      Effect.sync(() => {
        const routine: Routine = {
          id: RoutineId.make(`rtn_${routines.length + 1}`),
          name: input.name,
          items: input.items,
          createdAt: 0,
          updatedAt: 0,
          timesCompleted: 0,
          lastPerformedAt: null,
        };
        routines.unshift(routine);
        return routine;
      }),
    rename: unused,
    delete: unused,
    reorder: unused,
    setItem: unused,
    addItem: unused,
    removeItem: unused,
    markUsed: unused,
    replaceItems: unused,
  });

/** The stored snapshots, in a map by exercise id. */
export const ExerciseSnapshotRepositoryFake = (stored: Map<string, ExerciseSnapshot> = new Map()) =>
  Layer.succeed(ExerciseSnapshotRepository, {
    byId: id => Effect.sync(() => stored.get(id)),
    byIds: ids => Effect.sync(() => new Map([...stored].filter(([id]) => ids.includes(id)))),
    byName: name =>
      Effect.sync(() =>
        [...stored.values()].find(snapshot => snapshot.name.toLowerCase() === name.trim().toLowerCase()),
      ),
    upsert: snapshot => Effect.sync(() => void stored.set(snapshot.exerciseId, snapshot)),
  });

/** The catalog, holding `exercises`; `searchFails` makes every search fail with it. */
export const ExerciseCatalogFake = (
  exercises: readonly Exercise[],
  options: { readonly searchFails?: SqlError } = {},
) =>
  Layer.succeed(ExerciseCatalog, {
    installBundledIfNewer: unused(),
    find: id => Effect.succeed(exercises.find(exercise => exercise.id === id)),
    search: name =>
      options.searchFails === undefined
        ? Effect.succeed(exercises.filter(exercise => words(exercise.name).includes(words(name))))
        : Effect.fail(options.searchFails),
  });
