import { Clock, Effect } from 'effect';
import { RoutineRepository } from '@/features/routines';
import type { ExportableWorkout } from '@/features/transfer/domain/entities/Exportable';
import type { ExportTarget } from '@/features/transfer/domain/entities/TransferFormat';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';
import { exportFile, routinesJson, setsCsv, workoutsJson } from '@/features/transfer/domain/utils/exportDocuments';
import { type Activity, ActivityRepository } from '@/features/workouts';

/**
 * The workouts as the v2 files read them: every set as weight and reps, a reps-only set at
 * bodyweight and a timed one as 0 reps at bodyweight.
 */
function asWeightReps(activities: readonly Activity[]): ExportableWorkout[] {
  // HACK: the files learn the tracking types in transfer v3 (#193); this goes with it.
  return activities.map(activity => ({
    ...activity,
    strength:
      activity.strength === null
        ? null
        : {
            ...activity.strength,
            entries: activity.strength.entries.map(entry => ({
              ...entry,
              sets: entry.sets.map(set => ({
                index: set.index,
                completed: set.completed,
                rpe: set.rpe,
                reps: set.type === 'duration' ? 0 : set.reps,
                weightKg: set.type === 'weightReps' ? set.weightKg : 0,
                estimated1rm: set.type === 'weightReps' ? set.estimated1rm : null,
              })),
            })),
          },
  }));
}

/** The file for `target`, from what is on disk now. */
export const buildExport = (target: ExportTarget) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    switch (target) {
      case 'workoutsJson': {
        const activities = yield* (yield* ActivityRepository).list({ order: 'asc' });
        return exportFile('workouts', 'json', workoutsJson(asWeightReps(activities), now), now);
      }
      case 'setsCsv': {
        const activities = yield* (yield* ActivityRepository).list({ order: 'asc' });
        return exportFile('sets', 'csv', setsCsv(asWeightReps(activities)), now);
      }
      case 'routinesJson': {
        const routines = yield* (yield* RoutineRepository).list;
        return exportFile('routines', 'json', routinesJson(routines, now), now);
      }
    }
  });

/**
 * Exports `target` and hands it to the share sheet. It reads the repositories at the moment of
 * the tap rather than a cached list: an export is a copy of what is on disk now.
 */
export const exportData = (target: ExportTarget) =>
  Effect.gen(function* () {
    const file = yield* buildExport(target);
    yield* (yield* TransferDevice).share(file);
  });
