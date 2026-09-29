import { Effect, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine } from '@/features/routines/domain/schemas/RoutineSchema';

type RoutineService = (typeof RoutineRepository)['Service'];

/**
 * A `RoutineRepository` over a `Map`, most recent first like the real one. `failing` names one
 * method that fails with a `SqlError` instead.
 */
export const makeRoutineRepositoryFake = (routines: readonly Routine[] = [], failing?: keyof RoutineService) =>
  Layer.sync(RoutineRepository, () => {
    const stored = new Map(routines.map(routine => [routine.id, routine]));
    let minted = 0;
    const update = (id: RoutineId, change: (routine: Routine) => Routine) =>
      Effect.sync(() => {
        const routine = stored.get(id);
        if (routine !== undefined) stored.set(id, change(routine));
      });
    const service: RoutineService = {
      list: Effect.sync(() => [...stored.values()].reverse()),
      byId: id => Effect.sync(() => stored.get(id)),
      save: input =>
        Effect.sync(() => {
          const id = input.id ?? RoutineId.make(`rtn_new_${++minted}`);
          const previous = stored.get(id);
          const routine: Routine = {
            id,
            name: input.name.trim() || 'Untitled routine',
            items: input.items,
            createdAt: previous?.createdAt ?? 0,
            updatedAt: 0,
            timesCompleted: previous?.timesCompleted ?? 0,
            lastPerformedAt: previous?.lastPerformedAt ?? null,
          };
          stored.set(id, routine);
          return routine;
        }),
      rename: (id, name) => update(id, routine => ({ ...routine, name: name.trim() })),
      delete: id => Effect.sync(() => void stored.delete(id)),
      reorder: (id, orderedIds) =>
        update(id, routine => ({
          ...routine,
          items: orderedIds.flatMap(itemId => routine.items.filter(item => item.id === itemId)),
        })),
      setItem: (itemId, patch) =>
        Effect.sync(() => {
          for (const routine of stored.values()) {
            if (!routine.items.some(item => item.id === itemId)) continue;
            stored.set(routine.id, {
              ...routine,
              items: routine.items.map(item => (item.id === itemId ? { ...item, ...patch } : item)),
            });
          }
        }),
      addItem: (id, item) => update(id, routine => ({ ...routine, items: [...routine.items, item] })),
      removeItem: (id, itemId) =>
        update(id, routine => ({ ...routine, items: routine.items.filter(item => item.id !== itemId) })),
      markUsed: id => update(id, routine => ({ ...routine, timesCompleted: routine.timesCompleted + 1 })),
      replaceItems: (id, items) => update(id, routine => ({ ...routine, items })),
    };
    if (failing === undefined) return service;
    const failure = Effect.fail(new SqlError({ message: `fake ${failing} failed` }));
    return { ...service, [failing]: failing === 'list' ? failure : () => failure };
  });

/** An `ExerciseSnapshotRepository` over a `Map`, starting with `snapshots`. */
export const makeSnapshotRepositoryFake = (snapshots: readonly ExerciseSnapshot[] = []) =>
  Layer.sync(ExerciseSnapshotRepository, () => {
    const stored = new Map(snapshots.map(snapshot => [snapshot.exerciseId, snapshot]));
    return {
      byId: exerciseId => Effect.sync(() => stored.get(exerciseId)),
      byIds: exerciseIds => Effect.sync(() => new Map([...stored].filter(([id]) => exerciseIds.includes(id)))),
      byName: name => Effect.sync(() => [...stored.values()].find(snapshot => snapshot.name === name.trim())),
      upsert: snapshot => Effect.sync(() => void stored.set(snapshot.exerciseId, snapshot)),
    };
  });

/** Both fakes, for the use cases that write a routine and its snapshots. */
export const makeRoutinesFake = (routines: readonly Routine[] = [], snapshots: readonly ExerciseSnapshot[] = []) =>
  Layer.merge(makeRoutineRepositoryFake(routines), makeSnapshotRepositoryFake(snapshots));
