import { Clock, Effect } from 'effect';
import { RoutineRepository } from '@/features/routines';
import type { ExportTarget } from '@/features/transfer/domain/entities/TransferFormat';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';
import { exportFile, routinesJson, setsCsv, workoutsJson } from '@/features/transfer/domain/utils/exportDocuments';
import { ActivityRepository } from '@/features/workouts';

/** The file for `target`, from what is on disk now. */
export const buildExport = (target: ExportTarget) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    switch (target) {
      case 'workoutsJson': {
        const activities = yield* (yield* ActivityRepository).list({ order: 'asc' });
        return exportFile('workouts', 'json', workoutsJson(activities, now), now);
      }
      case 'setsCsv': {
        const activities = yield* (yield* ActivityRepository).list({ order: 'asc' });
        return exportFile('sets', 'csv', setsCsv(activities), now);
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
