import type { Routine, RoutineItem } from '@/domain/types';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/transfer/format';
import { buildWatchRoutines } from '../snapshot';

const item = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_1',
  exerciseId: 'wger:73',
  exerciseName: 'Bench Press',
  sets: 4,
  reps: '8-10',
  weightKg: 60,
  restSeconds: 120,
  notes: null,
  ...overrides,
});

const routine = (overrides: Partial<Routine> = {}): Routine => ({
  id: 'rtn_1',
  name: 'Push',
  items: [item()],
  createdAt: 0,
  updatedAt: 0,
  timesCompleted: 0,
  lastPerformedAt: null,
  ...overrides,
});

const at = new Date('2026-09-25T10:00:00.000Z');

describe('buildWatchRoutines', () => {
  it('writes the kinetiq.watch-routines v1 document with ids and the unit setting', () => {
    expect(buildWatchRoutines([routine()], 'imperial', at)).toEqual({
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
              reps: '8-10',
              weightKg: 60,
              restSeconds: 120,
              notes: null,
            },
          ],
        },
      ],
    });
  });

  it('clamps every value into ITEM_BOUNDS so the watch never rejects the snapshot', () => {
    const [out] = buildWatchRoutines(
      [
        routine({
          items: [
            item({
              sets: 99,
              weightKg: -5,
              restSeconds: 9999,
              reps: '1'.repeat(40),
              notes: 'n'.repeat(500),
            }),
            item({ id: 'rit_2', sets: 0, weightKg: 1000, restSeconds: Number.NaN }),
          ],
        }),
      ],
      'metric',
      at,
    ).routines;
    const [first, second] = out?.items ?? [];
    expect(first).toMatchObject({ sets: ITEM_BOUNDS.sets.max, weightKg: 0, restSeconds: 600 });
    expect(first?.reps).toHaveLength(ITEM_BOUNDS.repsLength);
    expect(first?.notes).toHaveLength(ITEM_BOUNDS.notesLength);
    expect(second).toMatchObject({ sets: 1, weightKg: ITEM_BOUNDS.weightKg.max, restSeconds: 0 });
  });

  it('cuts the lists to IMPORT_LIMITS', () => {
    const many = Array.from({ length: IMPORT_LIMITS.routines + 5 }, (_, i) =>
      routine({
        id: `rtn_${i}`,
        items: Array.from({ length: IMPORT_LIMITS.itemsPerRoutine + 3 }, (_, j) => item({ id: `rit_${j}` })),
      }),
    );
    const doc = buildWatchRoutines(many, 'metric', at);
    expect(doc.routines).toHaveLength(IMPORT_LIMITS.routines);
    expect(doc.routines[0]?.items).toHaveLength(IMPORT_LIMITS.itemsPerRoutine);
  });
});
