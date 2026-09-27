import { anActivity } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { longestStreak, summariseTraining, trainingHeatmap } from '@/features/workouts/domain/utils/trainingSummary';

/** Wednesday 18 June 2025, noon local. */
const NOW = new Date(2025, 5, 18, 12, 0, 0).getTime();
const at = (day: number, hour = 18) => new Date(2025, 5, day, hour, 0, 0).getTime();
const workoutOn = (day: number, id = `session-${day}`) =>
  anActivity({ id: ActivityId.make(id), startedAt: at(day), durationSeconds: 3600 });

describe('summariseTraining', () => {
  it('lists the weeks oldest first, so this week is the last', () => {
    const summary = summariseTraining([workoutOn(17), workoutOn(10)], 2, 2, NOW);

    expect(summary.weeks.map(week => week.weekStart)).toEqual([at(9, 0), at(16, 0)]);
    expect(summary.weeks.map(week => week.workouts)).toEqual([1, 1]);
  });

  it('totals the window and says whether anything is recorded at all', () => {
    const summary = summariseTraining([workoutOn(17)], 5, 1, NOW);

    expect(summary.totals).toEqual({ workouts: 1, durationSeconds: 3600, caloriesKcal: 278, volumeKg: 1000 });
    expect(summary.hasAnyHistory).toBe(true);
  });

  it('measures consistency against the days elapsed, not the whole window', () => {
    const summary = summariseTraining([workoutOn(16), workoutOn(17)], 2, 1, NOW);

    expect(summary.activeDays).toBe(2);
    expect(summary.consistency).toBeCloseTo(2 / 3);
  });

  it('has no history for an empty database', () => {
    expect(summariseTraining([], 0, 4, NOW).hasAnyHistory).toBe(false);
  });
});

describe('longestStreak', () => {
  it('is the longest run of consecutive training days', () => {
    expect(longestStreak([workoutOn(2), workoutOn(3), workoutOn(4), workoutOn(9)])).toBe(3);
  });

  it('counts two workouts on one day once', () => {
    expect(longestStreak([workoutOn(2, 'a'), workoutOn(2, 'b')])).toBe(1);
  });

  it('is zero with no workouts', () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe('trainingHeatmap', () => {
  it('puts the minutes on their day and leaves the days to come empty', () => {
    const heatmap = trainingHeatmap([workoutOn(17)], 1, NOW);

    expect(heatmap.days.map(day => day.value)).toEqual([0, 60, 0, 0, 0, 0, 0]);
    expect(heatmap.days.map(day => day.dayStart === null)).toEqual([false, false, false, true, true, true, true]);
    expect(heatmap.workouts).toBe(1);
  });
});
