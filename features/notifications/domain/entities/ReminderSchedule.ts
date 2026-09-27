/** The weekly training reminder the user asked for, as the scheduler reads it. */
export interface ReminderSchedule {
  readonly enabled: boolean;
  /** Minutes from local midnight. */
  readonly minuteOfDay: number;
  /** ISO weekday numbers, 1 = Monday to 7 = Sunday. */
  readonly days: readonly number[];
}
