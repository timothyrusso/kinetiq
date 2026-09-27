/**
 * The imperative routine calls the legacy callers (the workout commit, the watch sync, the
 * transfer) still make, run through the app runtime over the `routines` repository. Goes away
 * when those callers move into features: workouts (#53), watch-sync and transfer (#54).
 */
import { Effect, Stream } from 'effect';
import { runtime } from '@/features/core/runtime';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { type Routine, RoutineEvents, RoutineId, type RoutineItem, RoutineRepository } from '@/features/routines';

/** Every routine, most recently changed first. */
export function listAllRoutines(): Promise<readonly Routine[]> {
  return runtime.runPromise(Effect.flatMap(RoutineRepository, repo => repo.list));
}

/**
 * Counts a recorded workout against routine `id`. On the shared connection, so inside the
 * workout commit's transaction it is part of the same all-or-nothing write.
 */
export function markRoutineUsed(id: string, performedAt: number): Promise<void> {
  return runtime.runPromise(Effect.flatMap(RoutineRepository, repo => repo.markUsed(RoutineId.make(id), performedAt)));
}

/**
 * Writes an imported routine as a new routine under the name it came with. The snapshots it
 * needs are stored first, so no item points at an exercise the device does not have.
 */
export function saveImportedRoutine(routine: {
  readonly name: string;
  readonly items: readonly RoutineItem[];
  readonly snapshots: readonly ExerciseSnapshot[];
}): Promise<Routine> {
  return runtime.runPromise(
    Effect.gen(function* () {
      const stored = yield* ExerciseSnapshotRepository;
      for (const snapshot of routine.snapshots) yield* stored.upsert(snapshot);
      return yield* (yield* RoutineRepository).save({ name: routine.name, items: routine.items });
    }),
  );
}

const listeners = new Set<() => void>();
let forwarding = false;

/** Tells every listener the routines changed; a listener that throws cannot stop the others. */
export function notifyRoutinesChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[routines] change listener failed', error);
    }
  }
}

/**
 * Calls `listener` after every routine write. The first subscription starts one fiber that
 * forwards each `RoutineChanged` to the listeners.
 */
export function onRoutinesChanged(listener: () => void): () => void {
  listeners.add(listener);
  if (!forwarding) {
    forwarding = true;
    runtime.runFork(
      Effect.flatMap(RoutineEvents, events =>
        Stream.fromPubSub(events).pipe(Stream.runForEach(() => Effect.sync(notifyRoutinesChanged))),
      ),
    );
  }
  return () => {
    listeners.delete(listener);
  };
}
