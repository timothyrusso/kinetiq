import { aPlan, aPlanItem, loadedSets, plannedSets } from '@/features/workouts/__fixtures__/builders';
import { entryFromPlanItem, sessionFromPlan } from '@/features/workouts/domain/utils/sessionPlan';

const NOW = 1_750_000_000_000;

describe('entryFromPlanItem', () => {
  it('opens one set per planned set, on the plan’s reps and load', () => {
    const entry = entryFromPlanItem(aPlanItem());

    expect(entry.sets).toEqual(
      [0, 1, 2].map(index => ({
        type: 'weightReps',
        index,
        reps: 8,
        weightKg: 60,
        completed: false,
        estimated1rm: null,
        rpe: null,
      })),
    );
    expect(entry).toMatchObject({
      exerciseId: 'ex:barbell-bench-press',
      restSeconds: 90,
      muscleGroup: null,
      notes: null,
    });
  });

  it('opens each set on its own reps, load and target RPE', () => {
    const entry = entryFromPlanItem(
      aPlanItem({
        sets: [
          { type: 'weightReps', reps: 12, weightKg: 50, targetRpe: null },
          { type: 'weightReps', reps: 10, weightKg: 55, targetRpe: 7 },
          { type: 'weightReps', reps: 8, weightKg: 60, targetRpe: 9 },
        ],
      }),
    );

    expect(loadedSets(entry).map(({ index, reps, weightKg, rpe }) => ({ index, reps, weightKg, rpe }))).toEqual([
      { index: 0, reps: 12, weightKg: 50, rpe: null },
      { index: 1, reps: 10, weightKg: 55, rpe: 7 },
      { index: 2, reps: 8, weightKg: 60, rpe: 9 },
    ]);
  });

  it('gives an item planned with no sets one set of eight at bodyweight', () => {
    expect(entryFromPlanItem(aPlanItem({ sets: [] })).sets).toEqual([
      { type: 'weightReps', index: 0, reps: 8, weightKg: 0, completed: false, estimated1rm: null, rpe: null },
    ]);
  });

  it('gives a reps-only item planned with no sets one set of eight, and a timed one one of 30 s', () => {
    const base = { exerciseId: 'ex:plank', exerciseName: 'Plank', restSeconds: 60, notes: null };

    expect(entryFromPlanItem({ ...base, trackingType: 'repsOnly', sets: [] }).sets).toEqual([
      { type: 'repsOnly', index: 0, reps: 8, completed: false, rpe: null },
    ]);
    expect(entryFromPlanItem({ ...base, trackingType: 'duration', sets: [] }).sets).toEqual([
      { type: 'duration', index: 0, durationSeconds: 30, completed: false, rpe: null },
    ]);
  });

  it('opens a reps-only and a timed item on their own targets, each set tagged with the item’s type', () => {
    const base = { itemId: 'rit_core', exerciseId: 'ex:plank', exerciseName: 'Plank', restSeconds: 60, notes: null };

    const reps = entryFromPlanItem({
      ...base,
      trackingType: 'repsOnly',
      sets: [{ type: 'repsOnly', reps: 12, targetRpe: 7 }],
    });
    const timed = entryFromPlanItem({
      ...base,
      trackingType: 'duration',
      sets: [{ type: 'duration', durationSeconds: 90, targetRpe: null }],
    });

    expect(reps).toMatchObject({ trackingType: 'repsOnly', routineItemId: 'rit_core' });
    expect(reps.sets).toEqual([{ type: 'repsOnly', index: 0, reps: 12, completed: false, rpe: 7, routineSetIndex: 0 }]);
    expect(timed.trackingType).toBe('duration');
    expect(timed.sets).toEqual([
      { type: 'duration', index: 0, durationSeconds: 90, completed: false, rpe: null, routineSetIndex: 0 },
    ]);
  });

  it('marks an entry from a routine item with the item, and each set with the row it opens from', () => {
    const entry = entryFromPlanItem(aPlanItem({ itemId: 'rit_bench', sets: plannedSets(2, 8, 60) }));

    expect(entry.routineItemId).toBe('rit_bench');
    expect(entry.sets.map(set => set.routineSetIndex)).toEqual([0, 1]);
  });

  it('marks nothing on an entry that is not a routine item, nor on the fallback set', () => {
    const added = entryFromPlanItem(aPlanItem());
    const empty = entryFromPlanItem(aPlanItem({ itemId: 'rit_bench', sets: [] }));

    expect(added).not.toHaveProperty('routineItemId');
    expect(added.sets.every(set => !('routineSetIndex' in set))).toBe(true);
    expect(empty.sets[0]).not.toHaveProperty('routineSetIndex');
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

  it('keeps the routine items a routine plan starts with', () => {
    const plan = aPlan({
      items: [aPlanItem({ itemId: 'rit_bench' }), aPlanItem({ itemId: 'rit_press', exerciseId: 'ex:barbell-squat' })],
    });

    expect(sessionFromPlan(plan, NOW).routineItemIds).toEqual(['rit_bench', 'rit_press']);
  });

  it('keeps no routine items for a plan from no routine, or one whose items do not name themselves', () => {
    expect(sessionFromPlan(aPlan({ routineId: null, items: [aPlanItem({ itemId: 'x' })] }), NOW)).not.toHaveProperty(
      'routineItemIds',
    );
    expect(sessionFromPlan(aPlan(), NOW)).not.toHaveProperty('routineItemIds');
  });

  it('starts an empty workout with no entries', () => {
    expect(sessionFromPlan(aPlan({ routineId: null, items: [] }), NOW).entries).toEqual([]);
  });
});
