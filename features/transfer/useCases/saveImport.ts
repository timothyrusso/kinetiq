import { Effect } from 'effect';
import { localId } from '@/features/core/utils';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { type RoutineItem, RoutineRepository } from '@/features/routines';
import type { ResolvedRoutine } from '@/features/transfer/domain/entities/ResolvedImport';

/**
 * Writes each routine with a matched item as a new routine, and succeeds with how many. An import
 * never overwrites: a routine that went out and came back edited lands beside the original, and
 * the user deletes the one they no longer want. An unnamed routine is named by `fallbackName`,
 * numbered over the whole file, so it gets the name the preview showed; an item with no rest of
 * its own gets the user's default. An item keeps its planned sets in order (a v1 item was read
 * into identical ones by `parseRoutines`). The snapshots an item needs are stored
 * before it is written, so no item points at an exercise the device does not have.
 */
export const saveImport = (
  routines: readonly ResolvedRoutine<ExerciseSnapshot>[],
  fallbackName: (index: number) => string,
  defaultRestSeconds: number,
) =>
  Effect.gen(function* () {
    const snapshots = yield* ExerciseSnapshotRepository;
    const repository = yield* RoutineRepository;
    let saved = 0;
    for (const [index, routine] of routines.entries()) {
      const items: RoutineItem[] = [];
      for (const item of routine.items) {
        if (item.match.status === 'missing') continue;
        const { snapshot } = item.match;
        if (item.match.status !== 'stored') yield* snapshots.upsert(snapshot);
        items.push({
          // HACK: an imported item plans weight and reps until the routines file names its
          // tracking type in transfer v3 (#193).
          trackingType: 'weightReps',
          id: localId('rit'),
          exerciseId: snapshot.exerciseId,
          exerciseName: snapshot.name,
          sets: item.sets.map((set, setIndex) => ({ type: 'weightReps', index: setIndex, ...set })),
          restSeconds: item.restSeconds ?? defaultRestSeconds,
          notes: item.notes,
        });
      }
      if (items.length === 0) continue;
      yield* repository.save({ name: routine.name ?? fallbackName(index + 1), items });
      saved += 1;
    }
    return saved;
  });
