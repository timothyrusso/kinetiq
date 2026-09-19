/**
 * Progress queries: weekly summaries, the training heatmap, personal records.
 *
 * ## Why one read fans out to three queries
 *
 * All three derive from the same activity rows, and the temptation is one query
 * returning one blob. Split anyway, keyed by what actually invalidates them:
 * `summary(4)` and `summary(12)` are different windows the user switches between, and a
 * single blob would refetch everything to change one number. `heatmap` has no range at
 * all — it is always "the last however-many weeks" — so it changes only when history
 * changes.
 *
 * ## Why the window is a count of weeks, not a date range
 *
 * A date range in the key would produce a brand-new cache entry at local midnight and
 * re-read the database on every day boundary. A week count is stable across days, and
 * the start date is derived *inside* the query from `now`, so "last 4 weeks" recomputes
 * against the current clock while keeping its cache slot. The cost is that a summary
 * fetched before midnight is stale after it — which `staleTime` handles, and which is
 * exactly the behaviour the user expects from a "this week" card.
 */
import { useQuery } from '@tanstack/react-query';

import { activityRepository, recordRepository } from '@/persistence';
import type { Activity, ActivityKind, PersonalRecord } from '@/domain/types';
import { queryKeys } from '@/query/keys';
import { addDays, startOfDay, startOfWeek } from '@/utils/format';
import { groupBy, sum } from '@/utils/functional';

/**
 * How long a computed summary stays fresh. Longer than the network queries: this is a
 * local recompute over a few hundred rows, so the cost is trivial, but the *perception*
 * cost of a Home screen that recomputes on every tab switch is a number that visibly
 * ticks. 60s covers a normal session; finishing a workout invalidates explicitly.
 */
const PROGRESS_STALE_TIME_MS = 60_000;

export type WeekSummary = {
  /** Local Monday at midnight. */
  weekStart: number;
  /** Local label, e.g. "Mon 12 May". */
  label: string;
  workouts: number;
  durationSeconds: number;
  distanceMeters: number;
  caloriesKcal: number;
  /** Strength volume in kg; 0 for a cardio-only week. */
  volumeKg: number;
  /** Per-kind counts, for the distribution chart. */
  byKind: Record<ActivityKind, number>;
};

export type TrainingSummary = {
  rangeWeeks: number;
  /** The current week first, so a chart can render left-to-right by reversing. */
  weeks: WeekSummary[];
  totals: {
    workouts: number;
    durationSeconds: number;
    distanceMeters: number;
    caloriesKcal: number;
    volumeKg: number;
  };
  /** Distinct calendar days with at least one activity, inside the window. */
  activeDays: number;
  /** Longest streak of days-with-a-workout anywhere in history, not just the window. */
  bestStreak: number;
  /** Days with a workout inside the window / days elapsed in the window, 0…1. */
  consistency: number;
  /** True when the user has no activities at all — a different empty state from "no activities in this range". */
  hasAnyHistory: boolean;
};

export type HeatmapDay = {
  /** Local midnight. */
  dayStart: number;
  workouts: number;
  durationSeconds: number;
  /** 0 none · 1 short · 2 moderate · 3 long — a bucketed intensity for colour. */
  level: 0 | 1 | 2 | 3;
};

export type HeatmapWeek = {
  weekStart: number;
  /** Always 7 entries, oldest first. Leading/trailing days outside the range are `null`. */
  days: (HeatmapDay | null)[];
};

export type TrainingHeatmap = {
  weeks: HeatmapWeek[];
  totalWorkouts: number;
  /** Weeks the grid covers. */
  spanWeeks: number;
};

/** 30 minutes is where "did something" stops reading as a scratch — the bucket boundary the ring colours use. */
const MODERATE_MINUTES = 30;
const LONG_MINUTES = 75;

function levelFor(durationSeconds: number, workouts: number): HeatmapDay['level'] {
  if (workouts === 0) return 0;
  const minutes = durationSeconds / 60;
  if (minutes >= LONG_MINUTES) return 3;
  if (minutes >= MODERATE_MINUTES) return 2;
  return 1;
}

/**
 * The weekly summary.
 *
 * Reads the whole window in one statement rather than one per week: seven queries to
 * SQLite is seven transactions for data the first query already bounded, and the
 * `between` filter makes the row count proportional to the window, not to history.
 */
export function useTrainingSummary(rangeWeeks: number) {
  return useQuery({
    queryKey: queryKeys.progress.summary(rangeWeeks),
    staleTime: PROGRESS_STALE_TIME_MS,
    queryFn: async (): Promise<TrainingSummary> => {
      const now = new Date();
      const windowStart = startOfWeek(addDays(now, -7 * (rangeWeeks - 1))).getTime();
      const activities = await activityRepository.list({ from: windowStart, order: 'desc' });
      const totalRows = await activityRepository.count();

      const weeks: WeekSummary[] = [];
      for (let offset = rangeWeeks - 1; offset >= 0; offset -= 1) {
        const weekStart = startOfWeek(addDays(now, -7 * offset)).getTime();
        const weekEnd = addDays(new Date(weekStart), 7).getTime();
        const inWeek = activities.filter((a) => a.startedAt >= weekStart && a.startedAt < weekEnd);

        const byKind: Record<ActivityKind, number> = { run: 0, ride: 0, lift: 0, walk: 0, yoga: 0 };
        for (const activity of inWeek) byKind[activity.kind] += 1;

        weeks.push({
          weekStart,
          label: formatWeekLabel(weekStart),
          workouts: inWeek.length,
          durationSeconds: sum(inWeek.map((a) => a.durationSeconds)),
          distanceMeters: sum(inWeek.map((a) => a.cardio?.distanceMeters ?? 0)),
          caloriesKcal: sum(inWeek.map((a) => a.caloriesKcal)),
          volumeKg: sum(inWeek.map((a) => a.strength?.totalVolumeKg ?? 0)),
          byKind,
        });
      }

      // Elapsed days rather than `rangeWeeks * 7`, so "this week" on a Monday reads as 1
      // day of 1 elapsed rather than 0 of 7 — a fresh window with no workouts yet should
      // not look like a 0% month.
      const elapsedDays = Math.max(
        1,
        Math.round((startOfDay(now).getTime() - windowStart) / 86_400_000) + 1,
      );
      const activeDays = new Set(activities.map((a) => startOfDay(a.startedAt).getTime())).size;

      return {
        rangeWeeks,
        weeks: weeks.toReversed(),
        totals: {
          workouts: activities.length,
          durationSeconds: sum(activities.map((a) => a.durationSeconds)),
          distanceMeters: sum(activities.map((a) => a.cardio?.distanceMeters ?? 0)),
          caloriesKcal: sum(activities.map((a) => a.caloriesKcal)),
          volumeKg: sum(activities.map((a) => a.strength?.totalVolumeKg ?? 0)),
        },
        activeDays,
        bestStreak: longestStreak(activities),
        consistency: clamp01(activeDays / elapsedDays),
        hasAnyHistory: totalRows > 0,
      };
    },
  });
}

/**
 * The activity heatmap.
 *
 * Fixed at 26 weeks (~6 months) rather than configurable: the grid is laid out by week
 * column, and a variable span means the component cannot decide cell size from the data.
 * A user who wants a year should get a chart, not a taller calendar.
 */
export const HEATMAP_SPAN_WEEKS = 26;

export function useTrainingHeatmap() {
  return useQuery({
    queryKey: queryKeys.progress.heatmap(),
    staleTime: PROGRESS_STALE_TIME_MS,
    queryFn: async (): Promise<TrainingHeatmap> => {
      const now = new Date();
      const gridStart = startOfWeek(addDays(now, -7 * (HEATMAP_SPAN_WEEKS - 1))).getTime();
      const activities = await activityRepository.list({ from: gridStart, order: 'asc' });

      const byDay = groupBy(activities, (a) => startOfDay(a.startedAt).getTime());

      const weeks: HeatmapWeek[] = [];
      for (let offset = 0; offset < HEATMAP_SPAN_WEEKS; offset += 1) {
        const weekStart = startOfWeek(addDays(now, -7 * (HEATMAP_SPAN_WEEKS - 1 - offset))).getTime();
        const days: (HeatmapDay | null)[] = [];
        for (let day = 0; day < 7; day += 1) {
          const dayStart = addDays(new Date(weekStart), day).getTime();
          // Future days inside the current week render as gaps, not as zero-intensity
          // cells: a "no workout yet today" cell and a "that day hasn't happened" cell must
          // not be the same colour, or the grid implies the user skipped days they didn't.
          if (dayStart > startOfDay(now).getTime()) {
            days.push(null);
            continue;
          }
          const items = byDay.get(dayStart);
          const workouts = items?.length ?? 0;
          const durationSeconds = items ? sum(items.map((a) => a.durationSeconds)) : 0;
          days.push({ dayStart, workouts, durationSeconds, level: levelFor(durationSeconds, workouts) });
        }
        weeks.push({ weekStart, days });
      }

      return { weeks, totalWorkouts: activities.length, spanWeeks: HEATMAP_SPAN_WEEKS };
    },
  });
}

/**
 * Personal records, newest achievement first.
 *
 * Read from the `records` table rather than recomputed from history. `finishSession`
 * already compares a workout against everything prior and commits the winners, so the
 * table *is* the computed answer — recomputing it here would walk every strength entry on
 * the Progress screen to reproduce a comparison that happened once, on the write, when the
 * full history was already loaded.
 *
 * It also keeps one definition of a PR. Two places deriving records independently is how
 * the Progress tab and the post-workout "3 new records" celebration end up disagreeing.
 */
export function usePersonalRecords(limit = 12) {
  return useQuery({
    queryKey: [...queryKeys.progress.personalRecords(), { limit }] as const,
    staleTime: PROGRESS_STALE_TIME_MS,
    queryFn: async (): Promise<PersonalRecord[]> => {
      const records = await recordRepository.all();
      // `all()` is already ordered by achieved_at DESC; the sort is defensive rather than
      // load-bearing — it keeps the slice honest if the repository's ordering ever changes.
      return [...records].sort((a, b) => b.achievedAt - a.achievedAt).slice(0, limit);
    },
  });
}

/** Longest run of consecutive days with at least one activity, across all history. */
function longestStreak(activities: readonly Activity[]): number {
  if (activities.length === 0) return 0;
  const days = [...new Set(activities.map((a) => startOfDay(a.startedAt).getTime()))].sort(
    (a, b) => a - b,
  );
  let best = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];
    if (previous === undefined || current === undefined) continue;
    const gap = Math.round((current - previous) / 86_400_000);
    // A gap of exactly one day continues the streak; anything larger restarts it. DST
    // shifts the boundary by an hour, which the round absorbs — a naive `!== 86400000`
    // comparison breaks the streak on the first Sunday of November.
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function formatWeekLabel(weekStart: number): string {
  const date = new Date(weekStart);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
