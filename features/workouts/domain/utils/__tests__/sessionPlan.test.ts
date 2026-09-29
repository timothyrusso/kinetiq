import { aPlan, aPlanItem, plannedSets } from '@/features/workouts/__fixtures__/builders';
import { entryFromPlanItem, sessionFromPlan } from '@/features/workouts/domain/utils/sessionPlan';

const NOW = 1_750_000_000_000;

describe('entryFromPlanItem', () => {
  it('opens one set per planned set, on the plan’s reps and load', () => {
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

  it('opens each set on its own reps, load and target RPE', () => {
    const entry = entryFromPlanItem(
      aPlanItem({
        sets: [
          { reps: 12, weightKg: 50, targetRpe: null },
          { reps: 10, weightKg: 55, targetRpe: 7 },
          { reps: 8, weightKg: 60, targetRpe: 9 },
        ],
      }),
    );

    expect(entry.sets.map(({ index, reps, weightKg, rpe }) => ({ index, reps, weightKg, rpe }))).toEqual([
      { index: 0, reps: 12, weightKg: 50, rpe: null },
      { index: 1, reps: 10, weightKg: 55, rpe: 7 },
      { index: 2, reps: 8, weightKg: 60, rpe: 9 },
    ]);
  });

  it('gives an item planned with no sets one set of eight at bodyweight', () => {
    expect(entryFromPlanItem(aPlanItem({ sets: [] })).sets).toEqual([
      { index: 0, reps: 8, weightKg: 0, completed: false, estimated1rm: null, rpe: null },
    ]);
  });

  it('keeps a plan of twenty sets as twenty sets', () => {
    expect(entryFromPlanItem(aPlanItem({ sets: plannedSets(20, 5, 100) })).sets).toHaveLength(20);
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
