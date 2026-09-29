import { RoutineId } from '@/features/routines';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';
import { aRoutineItem as anItem, aRoutine, setsOf } from '@/features/watch-sync/__fixtures__/routines';
import { buildWatchRoutines } from '@/features/watch-sync/data/adapters/buildWatchRoutines';

const at = new Date('2026-09-25T10:00:00.000Z');

describe('buildWatchRoutines', () => {
  it('writes the kinetiq.watch-routines v2 document with ids, the unit setting and one row per set', () => {
    expect(buildWatchRoutines([aRoutine()], 'imperial', at)).toEqual({
      format: 'kinetiq.watch-routines',
      version: 2,
      exportedAt: '2026-09-25T10:00:00.000Z',
      unitSystem: 'imperial',
      routines: [
        {
          id: 'rtn_1',
          name: 'Push',
          items: [
            {
              id: 'rit_1',
              exerciseId: 'wger:73',
              exerciseName: 'Bench Press',
              sets: Array.from({ length: 4 }, () => ({ reps: 8, weightKg: 60, targetRpe: null })),
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
      { index: 0, reps: 12, weightKg: 40, targetRpe: null },
      { index: 1, reps: 10, weightKg: 50, targetRpe: 7 },
      { index: 2, reps: 6, weightKg: 62.5, targetRpe: 9 },
    ];
    const [routine] = buildWatchRoutines([aRoutine({ items: [anItem({ sets })] })], 'metric', at).routines;

    expect(routine?.items[0]?.sets).toEqual([
      { reps: 12, weightKg: 40, targetRpe: null },
      { reps: 10, weightKg: 50, targetRpe: 7 },
      { reps: 6, weightKg: 62.5, targetRpe: 9 },
    ]);
  });

  it('clamps values above the bounds to the maximum and cuts long text, so the watch never rejects it', () => {
    const [routine] = buildWatchRoutines(
      [
        aRoutine({
          items: [
            anItem({
              sets: [{ index: 0, reps: 500, weightKg: 1000, targetRpe: 12 }, ...setsOf(98, 8, -5).slice(1)],
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
    expect(item?.sets[0]).toEqual({ reps: ITEM_BOUNDS.reps.max, weightKg: ITEM_BOUNDS.weightKg.max, targetRpe: 10 });
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
            anItem({ id: 'rit_2', sets: [{ index: 0, reps: 0, weightKg: Number.NaN, targetRpe: -1 }] }),
          ],
        }),
      ],
      'metric',
      at,
    ).routines;

    expect(routine?.items[0]).toMatchObject({ sets: [{ reps: 8, weightKg: 0, targetRpe: null }], restSeconds: 0 });
    expect(routine?.items[1]?.sets).toEqual([{ reps: 1, weightKg: 0, targetRpe: 0 }]);
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
