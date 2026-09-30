import { Effect, Layer } from 'effect';
import { type Routine, RoutineRepository } from '@/features/routines';

const unused = () => Effect.die(new Error('not used by the watch sync'));

/** The routines as the watch sync reads them: a list, and nothing it writes. */
export const RoutineRepositoryFake = (routines: readonly Routine[]) =>
  Layer.succeed(RoutineRepository, {
    list: Effect.sync(() => routines),
    byId: id => Effect.sync(() => routines.find(routine => routine.id === id)),
    save: unused,
    rename: unused,
    delete: unused,
    reorder: unused,
    setItem: unused,
    addItem: unused,
    removeItem: unused,
    markUsed: unused,
    replaceItems: unused,
  });
