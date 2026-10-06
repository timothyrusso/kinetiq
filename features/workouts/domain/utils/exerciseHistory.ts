import { sum } from '@/features/core/utils';
import type { ExerciseHistory, ExercisePerformance } from '@/features/workouts/domain/entities/ExerciseHistory';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { estimatedOneRepMax } from '@/features/workouts/domain/utils/oneRepMax';
import { setVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

/** The history of an exercise nobody has logged. */
export const EMPTY_EXERCISE_HISTORY: ExerciseHistory = {
  sessions: [],
  weightTrend: [],
  repsTrend: [],
  durationTrend: [],
  sessionsCount: 0,
  bestWeightKg: null,
  bestReps: null,
  mostReps: null,
  longestDurationSeconds: null,
  bestEstimated1rmKg: null,
  bestVolumeKg: null,
  firstPerformedAt: null,
  lastPerformedAt: null,
};

/**
 * The entry for this exercise within a workout, matched on id alone. No name or suffix fallback:
 * the session copies the id it was given, and a looser match would let `ex:push-press` report the
 * numbers of `ex:push-press-behind-the-neck`, or a renamed custom exercise claim another's history.
 */
function findEntry(activity: Activity, exerciseId: string): StrengthEntry | null {
  const entries = activity.strength?.entries;
  if (!entries || entries.length === 0) return null;
  return entries.find(entry => entry.exerciseId === exerciseId) ?? null;
}

type Rollup = Omit<ExercisePerformance, 'activityId' | 'performedAt' | 'exerciseName'>;

const weightOf = (set: StrengthSet) => (set.type === 'weightReps' ? set.weightKg : 0);
const repsOf = (set: StrengthSet) => (set.type === 'duration' ? 0 : set.reps);
const secondsOf = (set: StrengthSet) => (set.type === 'duration' ? set.durationSeconds : 0);
const estimateOf = (set: StrengthSet) =>
  set.type === 'weightReps' ? estimatedOneRepMax(set.weightKg, set.reps) : null;

function rollUpSession(entry: StrengthEntry): Rollup {
  const completed: StrengthSet[] = entry.sets.filter(set => set.completed);
  const estimates = completed.map(estimateOf).filter((value): value is number => value !== null);
  // NOTE: a skipped exercise still counts as an encounter: it was planned and it happened, but
  // it contributed nothing, so its numbers stay 0 and its estimate empty.
  return {
    trackingType: entry.trackingType,
    volumeKg: sum(completed.map(setVolumeKg)),
    sets: entry.sets.length,
    completedSets: completed.length,
    topWeightKg: Math.max(0, ...completed.map(weightOf)),
    topReps: Math.max(0, ...completed.map(repsOf)),
    topDurationSeconds: Math.max(0, ...completed.map(secondsOf)),
    estimated1rmKg: estimates.length === 0 ? null : Math.max(...estimates),
  };
}

function maxBy<T>(items: readonly T[], value: (item: T) => number): T | null {
  if (items.length === 0) return null;
  let best = items[0];
  let bestValue = best === undefined ? -Infinity : value(best);
  for (const item of items) {
    const candidate = value(item);
    if (candidate > bestValue) {
      best = item;
      bestValue = candidate;
    }
  }
  return best ?? null;
}

/** The largest positive value of `pick` among `sessions`, or null when none is above 0. */
function bestOf(
  sessions: readonly ExercisePerformance[],
  pick: (session: ExercisePerformance) => number,
): number | null {
  const best = maxBy(sessions, pick);
  return best === null || pick(best) <= 0 ? null : pick(best);
}

/**
 * What the user has done with `exerciseId`, from every recorded workout. The workouts are parsed
 * before they are matched, so an id that is a substring of another never matches it. Each best
 * and each chart reads only the workouts tracked as its type: a loaded workout feeds the weight,
 * estimate, volume and rep bests and the weight line; a reps-only one the most reps; a timed one
 * the longest set.
 */
export function summariseExerciseHistory(exerciseId: string, activities: readonly Activity[]): ExerciseHistory {
  const sessions: ExercisePerformance[] = [];
  for (const activity of activities) {
    const entry = findEntry(activity, exerciseId);
    if (!entry) continue;
    sessions.push({
      activityId: activity.id,
      performedAt: activity.startedAt,
      exerciseName: entry.exerciseName,
      ...rollUpSession(entry),
    });
  }

  sessions.sort((a, b) => b.performedAt - a.performedAt);
  if (sessions.length === 0) return EMPTY_EXERCISE_HISTORY;

  const loaded = sessions.filter(session => session.trackingType === 'weightReps');
  const weighted = loaded.filter(session => session.topWeightKg > 0);
  const repsOnly = sessions.filter(session => session.trackingType === 'repsOnly' && session.topReps > 0);
  const timed = sessions.filter(session => session.trackingType === 'duration' && session.topDurationSeconds > 0);
  const point = (session: ExercisePerformance) => ({
    activityId: session.activityId,
    performedAt: session.performedAt,
  });

  return {
    sessions,
    weightTrend: weighted.map(session => ({ ...point(session), weightKg: session.topWeightKg })).reverse(),
    repsTrend: repsOnly.map(session => ({ ...point(session), reps: session.topReps })).reverse(),
    durationTrend: timed.map(session => ({ ...point(session), durationSeconds: session.topDurationSeconds })).reverse(),
    sessionsCount: sessions.length,
    bestWeightKg: bestOf(weighted, session => session.topWeightKg),
    bestReps: bestOf(loaded, session => session.topReps),
    mostReps: bestOf(repsOnly, session => session.topReps),
    longestDurationSeconds: bestOf(timed, session => session.topDurationSeconds),
    bestEstimated1rmKg: maxBy(weighted, session => session.estimated1rmKg ?? 0)?.estimated1rmKg ?? null,
    bestVolumeKg: maxBy(loaded, session => session.volumeKg)?.volumeKg ?? null,
    firstPerformedAt: sessions[sessions.length - 1]?.performedAt ?? null,
    lastPerformedAt: sessions[0]?.performedAt ?? null,
  };
}
