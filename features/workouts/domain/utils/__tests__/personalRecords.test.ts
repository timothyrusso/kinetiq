import { anActivity, anEntry, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import type { StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { detectPersonalRecords } from '@/features/workouts/domain/utils/personalRecords';

const NOW = WORKOUT_TIME + 86_400_000;

/** An earlier bench press workout made of `sets`. */
const earlierBench = (sets: StrengthSet[]) =>
  anActivity({
    strength: { entries: [anEntry({ sets })], totalVolumeKg: 0, totalSets: sets.length, personalRecords: [] },
  });

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

  it('gives no rep record for fewer loaded reps than the best before', () => {
    const tens = earlierBench([
      aSet({ reps: 10, weightKg: 61, estimated1rm: 81.3 }),
      aSet({ index: 1, reps: 9, weightKg: 65, estimated1rm: 84.5 }),
    ]);
    const eights = anEntry({ sets: [aSet({ reps: 8, weightKg: 60, estimated1rm: 76 })] });

    expect(detectPersonalRecords([eights], [tens], NOW)).toEqual([]);
  });

  it('reports more loaded reps than the best before, with the best it beat', () => {
    const tens = earlierBench([aSet({ reps: 10, weightKg: 61, estimated1rm: 81.3 })]);
    const elevens = anEntry({ sets: [aSet({ reps: 11, weightKg: 50, estimated1rm: 68.3 })] });

    const records = detectPersonalRecords([elevens], [tens], NOW);

    expect(records).toEqual([expect.objectContaining({ kind: 'maxReps', value: 11, previousValue: 10 })]);
  });

  it('ignores earlier bodyweight and unfinished sets as a rep baseline', () => {
    const earlier = earlierBench([
      aSet({ reps: 20, weightKg: 0, estimated1rm: null }),
      aSet({ index: 1, reps: 15, weightKg: 40, completed: false, estimated1rm: null }),
      aSet({ index: 2, reps: 5, weightKg: 100 }),
    ]);
    const tens = anEntry({ sets: [aSet({ reps: 10, weightKg: 50, estimated1rm: 66.7 })] });

    const records = detectPersonalRecords([tens], [earlier], NOW);

    expect(records).toEqual([expect.objectContaining({ kind: 'maxReps', value: 10, previousValue: 5 })]);
  });

  it('gives no rep record for bodyweight sets', () => {
    const bodyweight = anEntry({ sets: [aSet({ reps: 12, weightKg: 0, estimated1rm: null })] });

    expect(detectPersonalRecords([bodyweight], [], NOW)).toEqual([]);
  });
});
