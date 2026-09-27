import { sum } from '@/features/core/utils';
import type { ExerciseHistory, ExercisePerformance } from '@/features/workouts/domain/entities/ExerciseHistory';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { estimatedOneRepMax, setVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

/** The history of an exercise nobody has logged. */
export const EMPTY_EXERCISE_HISTORY: ExerciseHistory = {
  sessions: [],
  weightTrend: [],
  sessionsCount: 0,
  bestWeightKg: null,
  bestReps: null,
  bestEstimated1rmKg: null,
  bestVolumeKg: null,
  firstPerformedAt: null,
  lastPerformedAt: null,
};

/**
 * The entry for this exercise within a workout, matched on id alone. No name or suffix fallback:
 * the session copies the id it was given, and a looser match would let `wger:46` report the
 * numbers of `wger:146`, or a renamed custom exercise claim another's history.
 */
function findEntry(activity: Activity, exerciseId: string): StrengthEntry | null {
  const entries = activity.strength?.entries;
  if (!entries || entries.length === 0) return null;
  return entries.find(entry => entry.exerciseId === exerciseId) ?? null;
}

type Rollup = Omit<ExercisePerformance, 'activityId' | 'performedAt' | 'exerciseName'>;

function rollUpSession(entry: StrengthEntry): Rollup {
  const completed = entry.sets.filter(set => set.completed);
  if (completed.length === 0) {
    // NOTE: a skipped exercise still counts as an encounter: it was planned and it happened, but
    // it contributed nothing, so its load and estimate stay empty.
    return {
      volumeKg: 0,
      sets: entry.sets.length,
      completedSets: 0,
      topWeightKg: 0,
      topReps: 0,
      estimated1rmKg: null,
    };
  }
  const heaviest = completed.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
  const estimates = completed
    .map(set => estimatedOneRepMax(set.weightKg, set.reps))
    .filter((value): value is number => value !== null);

  return {
    volumeKg: sum(completed.map(setVolumeKg)),
    sets: entry.sets.length,
    completedSets: completed.length,
    topWeightKg: heaviest.weightKg,
    topReps: completed.reduce((max, set) => Math.max(max, set.reps), 0),
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

/**
 * What the user has done with `exerciseId`, from every recorded workout. The workouts are parsed
 * before they are matched, so an id that is a substring of another never matches it.
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

  const weighted = sessions.filter(session => session.topWeightKg > 0);
  const heaviest = maxBy(weighted, session => session.topWeightKg);
  const mostReps = maxBy(sessions, session => session.topReps);
  const best1rm = maxBy(weighted, session => session.estimated1rmKg ?? 0);
  const biggest = maxBy(sessions, session => session.volumeKg);

  return {
    sessions,
    weightTrend: weighted
      .map(session => ({
        activityId: session.activityId,
        performedAt: session.performedAt,
        weightKg: session.topWeightKg,
      }))
      .reverse(),
    sessionsCount: sessions.length,
    bestWeightKg: heaviest?.topWeightKg ?? null,
    bestReps: mostReps === null || mostReps.topReps <= 0 ? null : mostReps.topReps,
    bestEstimated1rmKg: best1rm?.estimated1rmKg ?? null,
    bestVolumeKg: biggest?.volumeKg ?? null,
    firstPerformedAt: sessions[sessions.length - 1]?.performedAt ?? null,
    lastPerformedAt: sessions[0]?.performedAt ?? null,
  };
}
