import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  anOpenSet,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { useExerciseEditorFormLogic } from '@/features/workouts/ui/components/ExerciseEditorForm/ExerciseEditorForm.logic';

const renderEditor = async (entry: StrengthEntry = anEntry(), units: UnitSystem = 'metric') => {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  const rendered = await renderHook(() =>
    useExerciseEditorFormLogic(entry, units, {
      onChangeSet: record('set'),
      onAddSet: record('add'),
      onRemoveSet: record('remove'),
      onChangeEntry: record('entry'),
      onChangeType: record('type'),
    }),
  );
  return { ...rendered, calls };
};

describe('useExerciseEditorFormLogic', () => {
  it('draws one row per set with its done state, an unrecorded RPE as zero', async () => {
    const entry = anEntry({ sets: [aSet({ rpe: 8 }), anOpenSet({ index: 1, reps: 3, weightKg: 110 })] });

    const { result } = await renderEditor(entry);

    expect(result.current.derived.rows).toEqual([
      { type: 'weightReps', key: 'set-0', index: 0, reps: 5, weight: 100, rpe: 8, completed: true },
      { type: 'weightReps', key: 'set-1', index: 1, reps: 3, weight: 110, rpe: 0, completed: false },
    ]);
  });

  it('draws a reps-only set with its reps alone and a timed set with its seconds', async () => {
    const reps = await renderEditor(aRepsOnlyEntry({ sets: [aRepsOnlySet({ reps: 15, rpe: 7 })] }));
    const timed = await renderEditor(
      aDurationEntry({ sets: [aDurationSet({ durationSeconds: 90, completed: false })] }),
    );

    expect(reps.result.current.derived.rows).toEqual([
      { type: 'repsOnly', key: 'set-0', index: 0, reps: 15, rpe: 7, completed: true },
    ]);
    expect(timed.result.current.derived.rows).toEqual([
      { type: 'duration', key: 'set-0', index: 0, durationSeconds: 90, rpe: 0, completed: false },
    ]);
    expect(timed.result.current.derived.duration).toEqual({ min: 5, max: 3600 });
  });

  it('writes the time of a timed set against its index', async () => {
    const { result, calls } = await renderEditor(aDurationEntry());

    await act(async () => result.current.effects.setDuration(1, 120));

    expect(calls).toEqual([['set', 1, { durationSeconds: 120 }]]);
  });

  it('offers the three tracking types and changes the type while no set is done', async () => {
    const { result, calls } = await renderEditor(anEntry({ sets: [anOpenSet()] }));

    await act(async () => {
      result.current.effects.changeType('weightReps');
      result.current.effects.changeType('repsOnly');
    });

    expect(result.current.derived.typeSegments.map(segment => segment.value)).toEqual([
      'weightReps',
      'repsOnly',
      'duration',
    ]);
    expect(result.current.derived.typeLocked).toBe(false);
    expect(calls).toEqual([['type', 'repsOnly']]);
  });

  it('locks the type once a set is done, and writes no change', async () => {
    const { result, calls } = await renderEditor(anEntry({ sets: [aSet(), anOpenSet({ index: 1 })] }));

    await act(async () => result.current.effects.changeType('duration'));

    expect(result.current.derived.typeLocked).toBe(true);
    expect(calls).toEqual([]);
  });

  it('sums the exercise up like a routine item, with the sets done after it', async () => {
    const { result } = await renderEditor(anEntry({ sets: [aSet(), anOpenSet({ index: 1, reps: 8 })] }));

    expect(result.current.derived.meta.map(item => item.label)).toEqual([
      tr('workout.set', { count: 2 }),
      tr('details.repsValue', { reps: '5-8' }),
      '100 kg',
      '1/2',
    ]);
  });

  it('takes the routine item’s bounds and the user’s unit', async () => {
    const { result } = await renderEditor(anEntry(), 'imperial');

    expect(result.current.derived).toMatchObject({
      unit: 'lb',
      weightStep: 2.5,
      weightMax: 1000,
      reps: { min: 1, max: 100 },
      rpe: { min: 0, max: 10 },
      rest: { min: 0, max: 600 },
    });
    expect(result.current.derived.rows[0]).toMatchObject({ weight: 220 });
  });

  it('writes each set change against the set’s own index, weight in kilograms', async () => {
    const { result, calls } = await renderEditor(anEntry(), 'imperial');

    await act(async () => {
      result.current.effects.setReps(1, 12);
      result.current.effects.setWeight(1, 225);
      result.current.effects.setRpe(1, 9);
      result.current.effects.setRpe(0, 0);
      result.current.effects.removeSet(0);
    });

    expect(calls).toEqual([
      ['set', 1, { reps: 12 }],
      ['set', 1, { weightKg: 102.06 }],
      ['set', 1, { rpe: 9 }],
      ['set', 0, { rpe: null }],
      ['remove', 0],
    ]);
  });

  it('writes the rest and the note to the exercise', async () => {
    const { result, calls } = await renderEditor();

    await act(async () => {
      result.current.effects.setRest(120);
      result.current.effects.setNotes('Pause at the chest');
    });

    expect(calls).toEqual([
      ['entry', { restSeconds: 120 }],
      ['entry', { notes: 'Pause at the chest' }],
    ]);
  });

  it('keeps the last set and stops adding at the routine’s most sets', async () => {
    const one = await renderEditor(anEntry({ sets: [aSet()] }));
    const full = await renderEditor(anEntry({ sets: Array.from({ length: 20 }, (_, index) => aSet({ index })) }));

    await act(async () => full.result.current.effects.addSet());

    expect(one.result.current.derived).toMatchObject({ canRemoveSet: false, canAddSet: true });
    expect(full.result.current.derived.canAddSet).toBe(false);
    expect(full.calls).toEqual([]);
  });

  it('says a rest of zero starts no timer', async () => {
    const { result } = await renderEditor(anEntry({ restSeconds: 0 }));

    expect(result.current.derived.zeroRest).toBe(true);
  });
});
