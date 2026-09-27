import { addDays, clamp, startOfDay, startOfWeek, sum } from '@/features/core/utils';
import type {
  TrainingDay,
  TrainingHeatmap,
  TrainingSummary,
  WeekSummary,
} from '@/features/workouts/domain/entities/TrainingSummary';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';

const DAY_MS = 86_400_000;

/** Local Monday at midnight of the first week of a window of `weeks` ending with this one. */
export function windowStart(now: number, weeks: number): number {
  return startOfWeek(addDays(new Date(now), -7 * (weeks - 1))).getTime();
}

function formatWeekLabel(weekStart: number): string {
  return new Date(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Longest run of consecutive days with at least one workout. A gap of exactly one day continues
 * the run; the rounding absorbs a daylight-saving hour, which a strict 24 h comparison would not.
 */
export function longestStreak(activities: readonly Activity[]): number {
  if (activities.length === 0) return 0;
  const days = [...new Set(activities.map(activity => startOfDay(activity.startedAt).getTime()))].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];
    if (previous === undefined || current === undefined) continue;
    const gap = Math.round((current - previous) / DAY_MS);
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * The summary of the `rangeWeeks` weeks ending with the one holding `now`, from the workouts that
 * started inside that window and the count of every workout ever recorded.
 */
export function summariseTraining(
  activities: readonly Activity[],
  recordedCount: number,
  rangeWeeks: number,
  now: number,
): TrainingSummary {
  const today = new Date(now);
  const start = windowStart(now, rangeWeeks);

  const weeks: WeekSummary[] = [];
  for (let offset = rangeWeeks - 1; offset >= 0; offset -= 1) {
    const weekStart = startOfWeek(addDays(today, -7 * offset)).getTime();
    const weekEnd = addDays(new Date(weekStart), 7).getTime();
    const inWeek = activities.filter(activity => activity.startedAt >= weekStart && activity.startedAt < weekEnd);
    weeks.push({
      weekStart,
      label: formatWeekLabel(weekStart),
      workouts: inWeek.length,
      durationSeconds: sum(inWeek.map(activity => activity.durationSeconds)),
      caloriesKcal: sum(inWeek.map(activity => activity.caloriesKcal)),
      volumeKg: sum(inWeek.map(activity => activity.strength?.totalVolumeKg ?? 0)),
    });
  }

  // NOTE: elapsed days rather than `rangeWeeks * 7`, so a Monday with no workout yet reads as 0 of
  // 1 rather than a 0% month.
  const elapsedDays = Math.max(1, Math.round((startOfDay(today).getTime() - start) / DAY_MS) + 1);
  const activeDays = new Set(activities.map(activity => startOfDay(activity.startedAt).getTime())).size;

  return {
    rangeWeeks,
    weeks,
    totals: {
      workouts: activities.length,
      durationSeconds: sum(activities.map(activity => activity.durationSeconds)),
      caloriesKcal: sum(activities.map(activity => activity.caloriesKcal)),
      volumeKg: sum(activities.map(activity => activity.strength?.totalVolumeKg ?? 0)),
    },
    activeDays,
    bestStreak: longestStreak(activities),
    consistency: clamp(activeDays / elapsedDays, 0, 1),
    hasAnyHistory: recordedCount > 0,
  };
}

/**
 * Minutes trained per day for the `weeks` weeks ending with this one, from the workouts that
 * started in them, bucketed by local midnight. Days after today have no `dayStart`, so the grid
 * draws "not yet" differently from "rested".
 */
export function trainingHeatmap(activities: readonly Activity[], weeks: number, now: number): TrainingHeatmap {
  const today = startOfDay(now).getTime();
  const gridStart = windowStart(now, weeks);

  const minutes = new Map<number, number>();
  for (const activity of activities) {
    const day = startOfDay(activity.startedAt).getTime();
    minutes.set(day, (minutes.get(day) ?? 0) + activity.durationSeconds / 60);
  }

  const days: TrainingDay[] = [];
  for (let index = 0; index < weeks * 7; index += 1) {
    // NOTE: `addDays` rather than a multiple of 24 h: a daylight-saving change inside the window
    // would shift every later square off its midnight key.
    const dayStart = startOfDay(addDays(new Date(gridStart), index)).getTime();
    days.push(
      dayStart > today ? { dayStart: null, value: 0 } : { dayStart, value: Math.round(minutes.get(dayStart) ?? 0) },
    );
  }
  return { days, workouts: activities.length };
}
