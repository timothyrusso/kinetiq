/**
 * Everything the user has *done* with one exercise.
 *
 * ## Why this is its own query and not a slice of Progress
 *
 * `useProgress` answers "how am I doing", which is a question about a date range and about
 * all exercises at once. This answers "what have I done with *this* one", which has no
 * range at all: a personal best from two years ago is still the personal best: and which
 * needs the per-set detail (reps, weight, whether the set was completed) that every
 * progress aggregate deliberately throws away. Two questions, two shapes, two cache keys:
 * one invalidates when history changes, the other when the user changes a window.
 *
 * ## Why the whole lift history is read and then filtered
 *
 * Sessions store their sets as one JSON blob per session (`strength.entries_json`), not as
 * a row per set, because a session is always read whole and a per-set table would be a
 * join nobody asked for. So "find every session containing exercise X" cannot be an index
 * lookup; it is a scan of the strength rows. A few hundred rows of JSON parse is a few
 * milliseconds, done once and cached: and it is honest in a way a `LIKE '%"wger:46"%'`
 * over the blob is not: the blob is parsed before it is matched, so an id that happens to
 * appear as a substring of a longer id cannot make one exercise report another's numbers.
 *
 * ## What is deliberately absent
 *
 * `previousValue` on a record. The `records` table holds one row per (exercise, kind) with
 * no history behind it, so the value it displaced is not stored anywhere. Rather than
 * reconstruct a plausible-sounding "previous best" from the log: which would be a
 * different number from the one Sentry-style record-keeping actually displaced: the
 * detail screen leaves the claim out. Absent beats invented.
 */
import { useQuery } from '@tanstack/react-query';

import { activityRepository, recordRepository } from '@/persistence';
import type { Activity, PersonalRecord, PersonalRecordKind, StrengthEntry } from '@/domain/types';
import { queryKeys } from '@/query/keys';
import { estimatedOneRepMax, setVolumeKg } from '@/domain/logic';
import type { UnitSystem } from '@/utils/format';
import { formatWeight } from '@/utils/format';
import { sum } from '@/utils/functional';
import type { TKey } from '@/i18n';
import { tr } from '@/i18n/tr';

/** Per-session rollup of one exercise, newest first. */
export type ExercisePerformance = {
  activityId: string;
  performedAt: number;
  /** As recorded on the session: a later rename does not rewrite history. */
  exerciseName: string;
  /** Volume across completed sets only, kg. */
  volumeKg: number;
  sets: number;
  completedSets: number;
  /** Heaviest completed set, kg. `0` means bodyweight was the load. */
  topWeightKg: number;
  topReps: number;
  /** Best estimated 1RM in the session, or null when no set supports the estimate. */
  estimated1rmKg: number | null;
};

/** One point of the heaviest-weight line: a session's heaviest completed set. */
type WeightPoint = {
  activityId: string;
  performedAt: number;
  weightKg: number;
};

export type ExerciseHistory = {
  sessions: ExercisePerformance[];
  /**
   * Heaviest completed set per session, oldest first, for the detail screen's line. Sessions
   * with no weighted set (bodyweight, or skipped) are left out rather than drawn as zero: a
   * dip to 0 kg would read as a collapse in strength that never happened.
   */
  weightTrend: WeightPoint[];
  sessionsCount: number;
  totalVolumeKg: number;
  totalSets: number;
  /** Heaviest completed set ever recorded, kg. Bodyweight work (0 kg) is excluded. */
  bestWeightKg: number | null;
  bestReps: number | null;
  bestEstimated1rmKg: number | null;
  /** Most volume in a single session, with the session that did it. */
  bestVolumeKg: number | null;
  firstPerformedAt: number | null;
  lastPerformedAt: number | null;
};

const EMPTY_HISTORY: ExerciseHistory = {
  sessions: [],
  weightTrend: [],
  sessionsCount: 0,
  totalVolumeKg: 0,
  totalSets: 0,
  bestWeightKg: null,
  bestReps: null,
  bestEstimated1rmKg: null,
  bestVolumeKg: null,
  firstPerformedAt: null,
  lastPerformedAt: null,
};

/**
 * How each record kind reads, in the order the UI lists them.
 *
 * These strings live here rather than in a screen because two screens show records: the
 * activity detail celebrates the ones set *in that session*, the exercise detail the ones
 * held *for that exercise*: and a user comparing the two should never see the same record
 * called two different things.
 */
/**
 * Record wording, as catalog KEYS.
 *
 * Keys rather than words because this is module scope: there is no language here, and a map
 * of English strings built at import time is a map that cannot be translated. Each of the
 * three screens that shows a record already has a `t`, so the lookup belongs there.
 *
 * "Most volume" rather than "Most volume in one exercise": the label shares a row with the
 * value on a 402pt screen and the longer phrase truncated to "Most volume in one exercis…".
 */
export const RECORD_LABEL: Record<PersonalRecordKind, TKey> = {
  est1rm: 'records.est1rm',
  volume: 'records.volume',
  maxReps: 'records.maxReps',
};

/** A record's value with its own unit: rep records are reps, everything else is weight. */
export function formatRecordValue(
  kind: PersonalRecordKind,
  value: number,
  units: UnitSystem,
): string {
  return kind === 'maxReps' ? tr('details.repsValue', { reps: Math.round(value) }) : formatWeight(value, units);
}

export function useExerciseHistory(exerciseId: string | null) {
  const query = useQuery({
    queryKey: [...queryKeys.exercises.all, 'history', exerciseId ?? 'none'] as const,
    queryFn: async (): Promise<ExerciseHistory> => {
      if (exerciseId === null) return EMPTY_HISTORY;
      const activities = await activityRepository.list();
      return summarise(exerciseId, activities);
    },
    enabled: exerciseId !== null,
    // Local recompute over a few hundred rows, but like the other progress reads it is
    // keyed to *content*: nothing changes it except finishing a session, which
    // invalidates explicitly.
    staleTime: 60_000,
  });

  // Records come from their own tiny table rather than from the scan above: the log tells
  // you what happened, the record table tells you what the app agreed was best at the time
  // it happened, and those are different claims: an estimate the user deletes from history
  // should not keep being a headline number, and a record set years ago should not depend
  // on the session that produced it still parsing cleanly.
  const records = useQuery({
    queryKey: [...queryKeys.exercises.all, 'records', exerciseId ?? 'none'] as const,
    queryFn: (): Promise<PersonalRecord[]> =>
      exerciseId === null ? Promise.resolve([]) : recordRepository.forExercise(exerciseId),
    enabled: exerciseId !== null,
    staleTime: 60_000,
  });

  return {
    history: query.data ?? EMPTY_HISTORY,
    records: records.data ?? EMPTY_RECORDS,
    isLoading: query.isLoading || records.isLoading,
    error: query.error ?? records.error,
    refresh: query.refetch,
  };
}

const EMPTY_RECORDS: readonly PersonalRecord[] = [];

function summarise(exerciseId: string, activities: readonly Activity[]): ExerciseHistory {
  const sessions: ExercisePerformance[] = [];

  for (const activity of activities) {
    const entry = findEntry(activity, exerciseId);
    if (!entry) continue;
    const rollup = rollUpSession(entry);
    if (rollup === null) continue;
    sessions.push({
      activityId: activity.id,
      performedAt: activity.startedAt,
      exerciseName: entry.exerciseName,
      ...rollup,
    });
  }

  sessions.sort((a, b) => b.performedAt - a.performedAt);
  if (sessions.length === 0) return EMPTY_HISTORY;

  const weighted = sessions.filter((session) => session.topWeightKg > 0);
  const heaviest = maxBy(weighted, (s) => s.topWeightKg);
  const mostReps = maxBy(sessions, (s) => s.topReps);
  const best1rm = maxBy(weighted, (s) => s.estimated1rmKg ?? 0);
  const biggest = maxBy(sessions, (s) => s.volumeKg);

  return {
    sessions,
    weightTrend: weighted
      .map((session) => ({
        activityId: session.activityId,
        performedAt: session.performedAt,
        weightKg: session.topWeightKg,
      }))
      .reverse(),
    sessionsCount: sessions.length,
    totalVolumeKg: sum(sessions.map((s) => s.volumeKg)),
    totalSets: sum(sessions.map((s) => s.completedSets)),
    bestWeightKg: heaviest?.topWeightKg ?? null,
    bestReps: mostReps === null || mostReps.topReps <= 0 ? null : mostReps.topReps,
    bestEstimated1rmKg: best1rm?.estimated1rmKg ?? null,
    bestVolumeKg: biggest?.volumeKg ?? null,
    firstPerformedAt: sessions[sessions.length - 1]?.performedAt ?? null,
    lastPerformedAt: sessions[0]?.performedAt ?? null,
  };
}

/**
 * The entry for this exercise within a session, matched on id alone.
 *
 * There is deliberately no name-based or suffix-based fallback. `entriesFromItems` writes
 * the routine item's `exerciseId` verbatim, and the session engine copies that forward, so
 * an exact id match is what the write path guarantees. A looser match, `endsWith`, or
 * comparing the renamed `exerciseName`: would trade that guarantee for the substring
 * hazard above (`wger:46` inside `wger:146`) and for a wrong-ownership bug the first time
 * a user renames a custom exercise, which is exactly the kind of plausible, silently-wrong
 * history number this screen exists to avoid printing.
 */
function findEntry(activity: Activity, exerciseId: string): StrengthEntry | null {
  const entries = activity.strength?.entries;
  if (!entries || entries.length === 0) return null;
  return entries.find((entry) => entry.exerciseId === exerciseId) ?? null;
}

function rollUpSession(entry: StrengthEntry) {
  const completed = entry.sets.filter((set) => set.completed);
  if (completed.length === 0) {
    // A skipped exercise still counts as an encounter: it was planned and it happened, // but it contributed nothing, so volume and load stay null rather than 0.
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
    .map((set) => estimatedOneRepMax(set.weightKg, set.reps))
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
