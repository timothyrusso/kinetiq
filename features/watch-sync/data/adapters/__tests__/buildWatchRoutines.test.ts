import { RoutineId } from '@/features/routines';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';
import { aRoutineItem as anItem, aRoutine, setsOf } from '@/features/watch-sync/__fixtures__/routines';
import { buildWatchRoutines } from '@/features/watch-sync/data/adapters/buildWatchRoutines';

const at = new Date('2026-09-25T10:00:00.000Z');

describe('buildWatchRoutines', () => {
  it('writes the kinetiq.watch-routines v1 document with ids and the unit setting, an item as its first set', () => {
    expect(buildWatchRoutines([aRoutine()], 'imperial', at)).toEqual({
      format: 'kinetiq.watch-routines',
      version: 1,
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
              sets: 4,
              reps: '8',
              weightKg: 60,
              restSeconds: 120,
              notes: null,
            },
          ],
        },
      ],
    });
  });

  it('clamps values above the bounds to the maximum and cuts long text, so the watch never rejects it', () => {
    const [routine] = buildWatchRoutines(
      [
        aRoutine({
          items: [anItem({ sets: setsOf(99, 8, -5), restSeconds: 9999, notes: 'n'.repeat(500) })],
        }),
      ],
      'metric',
      at,
    ).routines;
    const item = routine?.items[0];

    expect(item).toMatchObject({ sets: ITEM_BOUNDS.sets.max, weightKg: 0, restSeconds: 600 });
    expect(item?.notes).toHaveLength(ITEM_BOUNDS.notesLength);
  });

  it('clamps values below the bounds to the minimum, and a value that is not a number to it', () => {
    const [routine] = buildWatchRoutines(
      [
        aRoutine({
          items: [anItem({ sets: [], restSeconds: Number.NaN }), anItem({ id: 'rit_2', sets: setsOf(1, 8, 1000) })],
        }),
      ],
      'metric',
      at,
    ).routines;

    expect(routine?.items[0]).toMatchObject({ sets: 1, reps: '8', weightKg: 0, restSeconds: 0 });
    expect(routine?.items[1]).toMatchObject({ weightKg: ITEM_BOUNDS.weightKg.max });
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
