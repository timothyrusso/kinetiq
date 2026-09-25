/**
 * Whether the workout just saved is the one that met this week's goal.
 *
 * Exactly equal, not "at least": the goal is reached once, and the sixth workout of a five-a-week
 * goal is a normal finish. Counted the way the Profile ring counts (every workout since the
 * start of the week, `useTrainingSummary`), so the haptic and the ring agree on which workout
 * closed it.
 */
import { activityRepository } from '@/persistence';
import { getSettings } from '@/settings/store';
import { startOfWeek } from '@/utils/format';

export async function justReachedWeeklyGoal(now = Date.now()): Promise<boolean> {
  const thisWeek = await activityRepository.list({ from: startOfWeek(now).getTime() });
  return thisWeek.length === getSettings().weeklyGoalWorkouts;
}
