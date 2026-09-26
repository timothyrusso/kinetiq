/**
 * Writes a finished workout to history: the one path for a phone session and a workout from
 * the Apple Watch (issue #27).
 *
 * All or nothing, and idempotent. One transaction holds the duplicate check, the history read,
 * PR detection, the activity insert, the records and the routine's "trained" count and date, so
 * a crash cannot leave a workout without its PRs, or a routine counted for a workout that was
 * never saved. An activity with the same id already means "saved":
 * nothing is written and PR detection does not run again, because a replay would compare the
 * workout against a history that already contains it.
 */
import {
  activityRepository,
  recordRepository,
  routineRepository,
  withTransaction,
} from '@/persistence';
import { detectPersonalRecords } from '@/domain/logic';
import type { Activity, CompletedWorkout, PersonalRecord } from '@/domain/types';

export type CommitResult = {
  activity: Activity;
  personalRecords: PersonalRecord[];
};

/**
 * How far back PR detection looks. The same window `finishSession` always used: a record set
 * more than 400 sessions ago is not what "a PR" means to anyone.
 */
const HISTORY_WINDOW = 400;

/** Returns null when a workout with this id is already in history. */
export async function commitWorkout(workout: CompletedWorkout): Promise<CommitResult | null> {
  let result: CommitResult | null = null;
  await withTransaction(async () => {
    if ((await activityRepository.byId(workout.id)) !== null) return;
    // History before the insert: the workout being saved must not be its own baseline.
    const history = await activityRepository.list({ order: 'desc', limit: HISTORY_WINDOW });
    const personalRecords = detectPersonalRecords(workout.entries, history, workout.endedAt);
    const activity = await activityRepository.recordWorkout(workout, personalRecords);
    await recordRepository.commitManyInTransaction(personalRecords);
    // Phone and watch alike. The duplicate check above is what keeps a replayed workout from
    // counting twice. A routine deleted since the workout started simply matches no row.
    if (workout.routineId !== null) {
      await routineRepository.markPerformed(workout.routineId, workout.endedAt);
    }
    result = { activity, personalRecords };
  });
  return result;
}
