import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';

/** The workouts of one Monday-start week. */
export interface HistoryWeek {
  /** Local Monday at midnight. */
  readonly weekStart: number;
  readonly activities: readonly Activity[];
}

/** Every recorded workout, newest first, and the same rows grouped by week, newest week first. */
export interface ActivityHistory {
  readonly activities: readonly Activity[];
  readonly weeks: readonly HistoryWeek[];
}
