import { RoutineId, type RoutineItem } from '@/features/routines';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';
import { aRoutineItem as anItem, aRoutine, setsOf } from '@/features/watch-sync/__fixtures__/routines';
import { buildWatchRoutines } from '@/features/watch-sync/data/adapters/buildWatchRoutines';

const at = new Date('2026-09-25T10:00:00.000Z');

const pullUps: RoutineItem = {
  trackingType: 'repsOnly',
  id: 'rit_2',
  exerciseId: 'ex:pullups',
  exerciseName: 'Pull-up',
  sets: [
    { type: 'repsOnly', index: 0, reps: 10, targetRpe: null },
    { type: 'repsOnly', index: 1, reps: 8, targetRpe: 9 },
  ],
  restSeconds: 90,
  notes: null,
};

const plank: RoutineItem = {
  trackingType: 'duration',
  id: 'rit_3',
  exerciseId: 'ex:plank',
  exerciseName: 'Plank',
  sets: [
    { type: 'duration', index: 0, durationSeconds: 45, targetRpe: null },
    { type: 'duration', index: 1, durationSeconds: 60, targetRpe: 8 },
  ],
  restSeconds: 60,
  notes: null,
};

const itemsOf = (items: RoutineItem[]) => buildWatchRoutines([aRoutine({ items })], 'metric', at).routines[0]?.items;

describe('buildWatchRoutines', () => {
  it('writes the kinetiq.watch-routines v3 document with ids, the unit setting and one row per set', () => {
    expect(buildWatchRoutines([aRoutine()], 'imperial', at)).toEqual({
      format: 'kinetiq.watch-routines',
      version: 3,
      exportedAt: '2026-09-25T10:00:00.000Z',
      unitSystem: 'imperial',
      routines: [
        {
          id: 'rtn_1',
          name: 'Push',
          items: [
            {
              id: 'rit_1',
              exerciseId: 'ex:barbell-bench-press',
              exerciseName: 'Bench Press',
              trackingType: 'weightReps',
              sets: Array.from({ length: 4 }, () => ({ type: 'weightReps', reps: 8, weightKg: 60, targetRpe: null })),
              restSeconds: 120,
              notes: null,
            },
          ],
        },
      ],
    });
  });

  it('plans each set from its own row, with its target RPE', () => {
    const sets = [
      { type: 'weightReps' as const, index: 0, reps: 12, weightKg: 40, targetRpe: null },
      { type: 'weightReps' as const, index: 1, reps: 10, weightKg: 50, targetRpe: 7 },
      { type: 'weightReps' as const, index: 2, reps: 6, weightKg: 62.5, targetRpe: 9 },
    ];
    const [routine] = buildWatchRoutines([aRoutine({ items: [anItem({ sets })] })], 'metric', at).routines;

    expect(routine?.items[0]?.sets).toEqual([
      { type: 'weightReps', reps: 12, weightKg: 40, targetRpe: null },
      { type: 'weightReps', reps: 10, weightKg: 50, targetRpe: 7 },
      { type: 'weightReps', reps: 6, weightKg: 62.5, targetRpe: 9 },
    ]);
  });

  it('sends a reps-only item with reps alone and a timed item with its seconds, each set tagged', () => {
    const [reps, timed] = itemsOf([pullUps, plank]) ?? [];

    expect(reps).toMatchObject({ trackingType: 'repsOnly', restSeconds: 90 });
    expect(reps?.sets).toEqual([
      { type: 'repsOnly', reps: 10, targetRpe: null },
      { type: 'repsOnly', reps: 8, targetRpe: 9 },
    ]);
    expect(timed).toMatchObject({ trackingType: 'duration', restSeconds: 60 });
    expect(timed?.sets).toEqual([
      { type: 'duration', durationSeconds: 45, targetRpe: null },
      { type: 'duration', durationSeconds: 60, targetRpe: 8 },
    ]);
  });

  it('clamps reps and seconds to their bounds, rounding to whole numbers', () => {
    const [reps, timed] =
      itemsOf([
        { ...pullUps, sets: [{ type: 'repsOnly', index: 0, reps: 500, targetRpe: 12 }] },
        {
          ...plank,
          sets: [
            { type: 'duration', index: 0, durationSeconds: 1, targetRpe: null },
            { type: 'duration', index: 1, durationSeconds: 99_999, targetRpe: null },
            { type: 'duration', index: 2, durationSeconds: 47.6, targetRpe: null },
            { type: 'duration', index: 3, durationSeconds: Number.NaN, targetRpe: null },
          ],
        },
      ]) ?? [];

    expect(reps?.sets).toEqual([{ type: 'repsOnly', reps: ITEM_BOUNDS.reps.max, targetRpe: 10 }]);
    expect(timed?.sets.map(set => (set.type === 'duration' ? set.durationSeconds : null))).toEqual([
      ITEM_BOUNDS.durationSeconds.min,
      ITEM_BOUNDS.durationSeconds.max,
      48,
      ITEM_BOUNDS.durationSeconds.min,
    ]);
  });

  it('sends an item with no set row with the opening set of its own type', () => {
    const [loaded, reps, timed] =
      itemsOf([anItem({ sets: [] }), { ...pullUps, sets: [] }, { ...plank, sets: [] }]) ?? [];

    expect(loaded?.sets).toEqual([{ type: 'weightReps', reps: 8, weightKg: 0, targetRpe: null }]);
    expect(reps?.sets).toEqual([{ type: 'repsOnly', reps: 8, targetRpe: null }]);
    expect(timed?.sets).toEqual([{ type: 'duration', durationSeconds: 30, targetRpe: null }]);
  });

  it('clamps values above the bounds to the maximum and cuts long text, so the watch never rejects it', () => {
    const [routine] = buildWatchRoutines(
      [
        aRoutine({
          items: [
            anItem({
              sets: [
                { type: 'weightReps' as const, index: 0, reps: 500, weightKg: 1000, targetRpe: 12 },
                ...setsOf(98, 8, -5).slice(1),
              ],
              restSeconds: 9999,
              notes: 'n'.repeat(500),
            }),
          ],
        }),
      ],
      'metric',
      at,
    ).routines;
    const item = routine?.items[0];

    expect(item?.sets).toHaveLength(ITEM_BOUNDS.sets.max);
    expect(item?.sets[0]).toEqual({
      type: 'weightReps',
      reps: ITEM_BOUNDS.reps.max,
      weightKg: ITEM_BOUNDS.weightKg.max,
      targetRpe: 10,
    });
    expect(item?.sets[1]).toMatchObject({ weightKg: 0 });
    expect(item).toMatchObject({ restSeconds: 600 });
    expect(item?.notes).toHaveLength(ITEM_BOUNDS.notesLength);
  });

  it('clamps values below the bounds to the minimum, and a value that is not a number to it', () => {
    const [routine] = buildWatchRoutines(
      [
        aRoutine({
          items: [
            anItem({ sets: [], restSeconds: Number.NaN }),
            anItem({
              id: 'rit_2',
              sets: [{ type: 'weightReps' as const, index: 0, reps: 0, weightKg: Number.NaN, targetRpe: -1 }],
            }),
          ],
        }),
      ],
      'metric',
      at,
    ).routines;

    expect(routine?.items[0]).toMatchObject({
      sets: [{ type: 'weightReps', reps: 8, weightKg: 0, targetRpe: null }],
      restSeconds: 0,
    });
    expect(routine?.items[1]?.sets).toEqual([{ type: 'weightReps', reps: 1, weightKg: 0, targetRpe: 0 }]);
  });

  it('cuts the lists to IMPORT_LIMITS', () => {
    const many = Array.from({ length: IMPORT_LIMITS.routines + 5 }, (_, i) =>
      aRoutine({
        id: RoutineId.make(`rtn_${i}`),
        items: Array.from({ length: IMPORT_LIMITS.itemsPerRoutine + 3 }, (_, j) => anItem({ id: `rit_${j}` })),
      }),
    );

    const document = buildWatchRoutines(many, 'metric', at);

    expect(document.routines).toHaveLength(IMPORT_LIMITS.routines);
    expect(document.routines[0]?.items).toHaveLength(IMPORT_LIMITS.itemsPerRoutine);
  });
});
