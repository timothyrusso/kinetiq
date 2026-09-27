import { aPlan, aPlanItem } from '@/features/workouts/__fixtures__/builders';
import { entryFromPlanItem, sessionFromPlan } from '@/features/workouts/domain/utils/sessionPlan';

const NOW = 1_750_000_000_000;

describe('entryFromPlanItem', () => {
  it('opens every set on the number the rep range starts with, at the item’s load', () => {
    const entry = entryFromPlanItem(aPlanItem());

    expect(entry.sets).toEqual(
      [0, 1, 2].map(index => ({
        index,
        reps: 8,
        weightKg: 60,
        completed: false,
        estimated1rm: null,
        rpe: null,
      })),
    );
    expect(entry).toMatchObject({ exerciseId: 'wger:73', restSeconds: 90, muscleGroup: null, notes: null });
  });

  it('gives an item planned with no sets one set', () => {
    expect(entryFromPlanItem(aPlanItem({ sets: 0 })).sets).toHaveLength(1);
  });
});

describe('sessionFromPlan', () => {
  it('starts an active session on its first exercise, named for the time it started', () => {
    const session = sessionFromPlan(aPlan(), NOW);

    expect(session).toMatchObject({
      id: `session-${NOW.toString(36)}`,
      routineId: 'rtn_push',
      routineName: 'Push Day',
      startedAt: NOW,
      updatedAt: NOW,
      elapsedSeconds: 0,
      status: 'active',
      activeIndex: 0,
      restEndsAt: null,
    });
    expect(session.entries.map(entry => entry.exerciseName)).toEqual(['Bench Press', 'Overhead Press']);
  });

  it('starts an empty workout with no entries', () => {
    expect(sessionFromPlan(aPlan({ routineId: null, items: [] }), NOW).entries).toEqual([]);
  });
});
