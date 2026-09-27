import { anActivity } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { groupByWeek } from '@/features/workouts/domain/utils/groupByWeek';

const on = (day: number) =>
  anActivity({ id: ActivityId.make(`session-${day}`), startedAt: new Date(2025, 5, day, 18).getTime() });

describe('groupByWeek', () => {
  it('starts a new week wherever the Monday changes, newest week first', () => {
    const history = groupByWeek([on(18), on(16), on(12)]);

    expect(history.weeks.map(week => week.activities.map(activity => activity.id))).toEqual([
      ['session-18', 'session-16'],
      ['session-12'],
    ]);
    expect(history.activities).toHaveLength(3);
  });

  it('has no weeks for no workouts', () => {
    expect(groupByWeek([]).weeks).toEqual([]);
  });
});
