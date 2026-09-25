/**
 * The weekly training summary: Home's load chart and Profile's last-four-weeks tiles.
 *
 * Keyed by window, so `summary(4)` and `summary(8)` are separate cache entries and one
 * screen's window never refetches the other's.
 *
 * ## Why the window is a count of weeks, not a date range
 *
 * A date range in the key would produce a brand-new cache entry at local midnight and
 * re-read the database on every day boundary. A week count is stable across days, and
 * the start date is derived *inside* the query from `now`, so "last 4 weeks" recomputes
 * against the current clock while keeping its cache slot. The cost is that a summary
 * fetched before midnight is stale after it: which `staleTime` handles, and which is
 * exactly the behaviour the user expects from a "this week" card.
 */
import { useQuery } from '@tanstack/react-query';

import { activityRepository } from '@/persistence';
import type { Activity } from '@/domain/types';
import type { HeatmapDay } from '@/ui/charts/HeatmapCalendar';
import { queryKeys } from '@/query/keys';
import { addDays, startOfDay, startOfWeek } from '@/utils/format';
import { sum } from '@/utils/functional';

/**
 * How long a computed summary stays fresh. Longer than the network queries: this is a
 * local recompute over a few hundred rows, so the cost is trivial, but the *perception*
 * cost of a Home screen that recomputes on every tab switch is a number that visibly
 * ticks. 60s covers a normal session; finishing a workout invalidates explicitly.
 */
const PROGRESS_STALE_TIME_MS = 60_000;

type WeekSummary = {
  /** Local Monday at midnight. */
  weekStart: number;
  /** Local label, e.g. "Mon 12 May". */
  label: string;
  workouts: number;
  durationSeconds: number;
  caloriesKcal: number;
  /** Strength volume in kg. */
  volumeKg: number;
};

export type TrainingSummary = {
  rangeWeeks: number;
  /** The current week first, so a chart can render left-to-right by reversing. */
  weeks: WeekSummary[];
  totals: {
    workouts: number;
    durationSeconds: number;
    caloriesKcal: number;
    volumeKg: number;
  };
  /** Distinct calendar days with at least one activity, inside the window. */
  activeDays: number;
  /** Longest streak of days-with-a-workout anywhere in history, not just the window. */
  bestStreak: number;
  /** Days with a workout inside the window / days elapsed in the window, 0…1. */
  consistency: number;
  /** True when the user has no activities at all: a different empty state from "no activities in this range". */
  hasAnyHistory: boolean;
};

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

        weeks.push({
          weekStart,
          label: formatWeekLabel(weekStart),
          workouts: inWeek.length,
          durationSeconds: sum(inWeek.map((a) => a.durationSeconds)),
          caloriesKcal: sum(inWeek.map((a) => a.caloriesKcal)),
          volumeKg: sum(inWeek.map((a) => a.strength?.totalVolumeKg ?? 0)),
        });
      }

      // Elapsed days rather than `rangeWeeks * 7`, so "this week" on a Monday reads as 1
      // day of 1 elapsed rather than 0 of 7: a fresh window with no workouts yet should
      // not look like a 0% month.
      const elapsedDays = Math.max(
        1,
        Math.round((startOfDay(now).getTime() - windowStart) / 86_400_000) + 1,
      );
      const activeDays = new Set(activities.map((a) => startOfDay(a.startedAt).getTime())).size;

      // Oldest-first. `weeks.push` walks `offset` down from oldest to newest, so the loop
      // already builds chronological order, which is what every chart wants (left to right
      // is time) and what `slice(-6)` means. An earlier version reversed this to put "this
      // week" at index 0; the three call sites that read it disagreed about the direction,
      // and Home's goal ring quietly reported the oldest week in the window as the current
      // one. So the order is oldest-first, `thisWeek` is `at(-1)`, and the contract is
      // stated here because getting it wrong is silent rather than loud.
      return {
        rangeWeeks,
        weeks,
        totals: {
          workouts: activities.length,
          durationSeconds: sum(activities.map((a) => a.durationSeconds)),
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
    // shifts the boundary by an hour, which the round absorbs: a naive `!== 86400000`
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

export type TrainingHeatmap = {
  /** Oldest first, from a Monday, `weeks * 7` long. Days after today are `dayStart: null`. */
  days: HeatmapDay[];
  workouts: number;
};

/**
 * Minutes trained per day for the heatmap, the last `weeks` weeks ending with this one.
 *
 * Built here rather than on screen: a few hundred rows bucketed by local midnight is exactly
 * the grouping CLAUDE.md keeps out of render. Days later than today are `null` so the grid can
 * draw "not yet" differently from "rested".
 */
export function useTrainingHeatmap(weeks: number) {
  return useQuery({
    queryKey: queryKeys.progress.heatmap(weeks),
    staleTime: PROGRESS_STALE_TIME_MS,
    queryFn: async (): Promise<TrainingHeatmap> => {
      const now = new Date();
      const today = startOfDay(now).getTime();
      const gridStart = startOfWeek(addDays(now, -7 * (weeks - 1))).getTime();
      const activities = await activityRepository.list({ from: gridStart, order: 'asc' });

      const minutes = new Map<number, number>();
      for (const activity of activities) {
        const day = startOfDay(activity.startedAt).getTime();
        minutes.set(day, (minutes.get(day) ?? 0) + activity.durationSeconds / 60);
      }

      const days: HeatmapDay[] = [];
      for (let i = 0; i < weeks * 7; i += 1) {
        // `addDays` rather than `+ i * 86_400_000`: a DST change inside the window would
        // otherwise shift every later square by an hour and off its midnight key.
        const dayStart = startOfDay(addDays(new Date(gridStart), i)).getTime();
        days.push(
          dayStart > today
            ? { dayStart: null, value: 0 }
            : { dayStart, value: Math.round(minutes.get(dayStart) ?? 0) },
        );
      }
      return { days, workouts: activities.length };
    },
  });
}
