import { startOfWeek } from '@/features/core/utils';
import type { ActivityHistory } from '@/features/workouts/domain/entities/ActivityHistory';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';

/** Groups workouts that arrive newest first: a new week starts wherever the Monday changes. */
export function groupByWeek(items: readonly Activity[]): ActivityHistory {
  const weeks: { weekStart: number; activities: Activity[] }[] = [];
  for (const activity of items) {
    const weekStart = startOfWeek(activity.startedAt).getTime();
    const current = weeks.at(-1);
    if (current && current.weekStart === weekStart) current.activities.push(activity);
    else weeks.push({ weekStart, activities: [activity] });
  }
  return { activities: [...items], weeks };
}
