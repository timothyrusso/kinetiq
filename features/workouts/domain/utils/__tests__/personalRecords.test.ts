import { anActivity, anEntry, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { detectPersonalRecords } from '@/features/workouts/domain/utils/personalRecords';

const NOW = WORKOUT_TIME + 86_400_000;

describe('detectPersonalRecords', () => {
  it('reports a first estimated max with nothing before it', () => {
    const records = detectPersonalRecords([anEntry()], [], NOW);

    expect(records).toEqual([
      {
        exerciseId: 'wger:73',
        exerciseName: 'Bench Press',
        kind: 'est1rm',
        value: 116.5,
        achievedAt: NOW,
        previousValue: null,
      },
    ]);
  });

  it('reports a heavier estimate with the best it beat', () => {
    const heavier = anEntry({ sets: [aSet({ weightKg: 110, estimated1rm: 128 })] });

    const [record] = detectPersonalRecords([heavier], [anActivity()], NOW);

    expect(record).toMatchObject({ kind: 'est1rm', value: 128, previousValue: 116.5 });
  });

  it('reports nothing for a workout that matched the best before it', () => {
    expect(detectPersonalRecords([anEntry()], [anActivity()], NOW)).toEqual([]);
  });

  it('ignores history from after the workout, which cannot be its baseline', () => {
    const later = anActivity({ startedAt: NOW + 1 });

    expect(detectPersonalRecords([anEntry()], [later], NOW)).toHaveLength(1);
  });

  it('counts only completed sets', () => {
    const undone = anEntry({ sets: [aSet({ completed: false, weightKg: 200, estimated1rm: null })] });

    expect(detectPersonalRecords([undone], [], NOW)).toEqual([]);
  });

  it('reports a rep record from eight loaded reps up, with no earlier rep record to beat', () => {
    const eights = anEntry({ sets: [aSet({ reps: 8, weightKg: 80, estimated1rm: 101.5 })] });

    const records = detectPersonalRecords([eights], [], NOW);

    expect(records.map(record => [record.kind, record.value])).toEqual([
      ['est1rm', 101.5],
      ['maxReps', 8],
    ]);
  });

  it('gives no rep record for bodyweight sets', () => {
    const bodyweight = anEntry({ sets: [aSet({ reps: 12, weightKg: 0, estimated1rm: null })] });

    expect(detectPersonalRecords([bodyweight], [], NOW)).toEqual([]);
  });
});
