import { aDurationItem, aRepsOnlyItem, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import type { WeightRepsRoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';
import {
  defaultItemTarget,
  itemAs,
  itemWrite,
  newRoutineSet,
  patchItem,
  removeSet,
  resizeSets,
  routineItemOf,
  routineSetAs,
  uniformSets,
  withSet,
} from '@/features/routines/domain/utils/itemTargets';

const loaded = (
  index: number,
  reps: number,
  weightKg: number,
  targetRpe: number | null = null,
): WeightRepsRoutineSet => ({
  type: 'weightReps',
  index,
  reps,
  weightKg,
  targetRpe,
});

describe('defaultItemTarget', () => {
  it('plans three sets of eight at bodyweight for a loaded exercise, resting for the default', () => {
    expect(defaultItemTarget('weightReps', 75)).toEqual({
      trackingType: 'weightReps',
      sets: uniformSets(3, 8, 0),
      restSeconds: 75,
      notes: null,
    });
  });

  it('plans three sets of eight reps for a reps-only exercise', () => {
    expect(defaultItemTarget('repsOnly', 90)).toEqual({
      trackingType: 'repsOnly',
      sets: [0, 1, 2].map(index => ({ type: 'repsOnly', index, reps: 8, targetRpe: null })),
      restSeconds: 90,
      notes: null,
    });
  });

  it('plans three holds of 30 s for a timed exercise', () => {
    expect(defaultItemTarget('duration', 60)).toEqual({
      trackingType: 'duration',
      sets: [0, 1, 2].map(index => ({ type: 'duration', index, durationSeconds: 30, targetRpe: null })),
      restSeconds: 60,
      notes: null,
    });
  });
});

describe('routineSetAs', () => {
  it('carries the reps between weight and reps and reps only, and drops the weight', () => {
    expect(routineSetAs(loaded(1, 10, 60, 8), 'repsOnly')).toEqual({
      type: 'repsOnly',
      index: 1,
      reps: 10,
      targetRpe: 8,
    });
    expect(routineSetAs({ type: 'repsOnly', index: 0, reps: 12, targetRpe: null }, 'weightReps')).toEqual(
      loaded(0, 12, 0),
    );
  });

  it('opens a set changing to or from a timed one on the new type’s defaults, keeping its place and target', () => {
    expect(routineSetAs(loaded(2, 5, 100, 9), 'duration')).toEqual({
      type: 'duration',
      index: 2,
      durationSeconds: 30,
      targetRpe: 9,
    });
    expect(routineSetAs({ type: 'duration', index: 0, durationSeconds: 90, targetRpe: null }, 'repsOnly')).toEqual({
      type: 'repsOnly',
      index: 0,
      reps: 8,
      targetRpe: null,
    });
  });

  it('leaves a set already of the type as it is', () => {
    const set = loaded(0, 5, 100);

    expect(routineSetAs(set, 'weightReps')).toBe(set);
  });
});

describe('itemAs', () => {
  it('changes the type with every set carried over', () => {
    expect(itemAs(aRoutineItem({ sets: [loaded(0, 10, 60), loaded(1, 8, 70)] }), 'repsOnly')).toEqual({
      trackingType: 'repsOnly',
      sets: [
        { type: 'repsOnly', index: 0, reps: 10, targetRpe: null },
        { type: 'repsOnly', index: 1, reps: 8, targetRpe: null },
      ],
    });
  });

  it('changes nothing for the type the item already has', () => {
    expect(itemAs(aDurationItem(), 'duration')).toEqual({});
  });
});

describe('routineItemOf', () => {
  it('keeps only the sets of the item’s type', () => {
    const { trackingType: _type, sets: _sets, ...fields } = aRepsOnlyItem();
    const sets = [...aRepsOnlyItem().sets, ...aDurationItem().sets];

    expect(routineItemOf(fields, 'repsOnly', sets)).toEqual(aRepsOnlyItem());
    expect(routineItemOf(fields, 'duration', sets)).toEqual({
      ...fields,
      trackingType: 'duration',
      sets: aDurationItem().sets,
    });
  });
});

describe('patchItem', () => {
  it('changes the targets the patch names and leaves the others', () => {
    expect(patchItem(aRoutineItem({ notes: 'Slow' }), { restSeconds: 120 })).toEqual(
      aRoutineItem({ notes: 'Slow', restSeconds: 120 }),
    );
    expect(patchItem(aRoutineItem({ notes: 'Slow' }), { notes: null })).toEqual(aRoutineItem());
  });

  it('applies a type change with its sets', () => {
    const item = aRoutineItem();

    expect(patchItem(item, itemAs(item, 'duration'))).toMatchObject({
      trackingType: 'duration',
      sets: [0, 1, 2].map(index => ({ type: 'duration', index, durationSeconds: 30 })),
    });
  });
});

describe('itemWrite', () => {
  it('writes a patch that leaves the sets alone as it is', () => {
    expect(itemWrite(aRoutineItem(), { restSeconds: 30 })).toEqual({ restSeconds: 30 });
  });

  it('names the type beside sets written alone, and only the sets of that type', () => {
    const sets = [...aRepsOnlyItem().sets, loaded(3, 5, 50)];

    expect(itemWrite(aRepsOnlyItem(), { sets })).toEqual({ trackingType: 'repsOnly', sets: aRepsOnlyItem().sets });
  });
});

describe('resizeSets', () => {
  it('grows by copying the last set, and cuts from the end', () => {
    const sets = [loaded(0, 10, 60), loaded(1, 8, 70)];

    expect(resizeSets(sets, 3, 'weightReps')).toEqual([...sets, loaded(2, 8, 70)]);
    expect(resizeSets(sets, 1, 'weightReps')).toEqual([sets[0]]);
  });

  it('opens an empty item on the type’s default set', () => {
    expect(resizeSets([], 1, 'duration')).toEqual([newRoutineSet('duration', 0)]);
  });
});

describe('withSet', () => {
  it('writes the values the set’s type records and ignores the others', () => {
    const timed = aDurationItem().sets;

    expect(withSet(timed, 1, { durationSeconds: 60, reps: 20, weightKg: 40 })[1]).toEqual({
      type: 'duration',
      index: 1,
      durationSeconds: 60,
      targetRpe: null,
    });
    expect(withSet(aRepsOnlyItem().sets, 0, { reps: 12, weightKg: 40, targetRpe: 9 })[0]).toEqual({
      type: 'repsOnly',
      index: 0,
      reps: 12,
      targetRpe: 9,
    });
    expect(withSet([loaded(0, 8, 60, 7)], 0, { weightKg: 65, targetRpe: null })).toEqual([loaded(0, 8, 65)]);
  });
});

describe('removeSet', () => {
  it('removes the set and numbers the rest from 0, keeping the last one', () => {
    const sets = [loaded(0, 10, 60), loaded(1, 8, 70), loaded(2, 6, 80)];

    expect(removeSet(sets, 1)).toEqual([loaded(0, 10, 60), loaded(1, 6, 80)]);
    expect(removeSet([loaded(0, 10, 60)], 0)).toEqual([loaded(0, 10, 60)]);
  });
});
