import { act, renderHook } from '@testing-library/react-native';
import { setLanguagePreference } from '@/features/core/translations';
import { useRoutineSetRowLogic } from '@/features/routines/ui/components/RoutineSetRow/RoutineSetRow.logic';

const renderRow = async (index = 1) => {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  const rendered = await renderHook(() =>
    useRoutineSetRowLogic({
      index,
      unit: 'kg',
      onReps: record('reps'),
      onWeight: record('weight'),
      onRpe: record('rpe'),
      onRemove: record('remove'),
    }),
  );
  return { ...rendered, calls };
};

describe('useRoutineSetRowLogic', () => {
  afterEach(() => setLanguagePreference('system'));

  it('hands its own index to every writer', async () => {
    const { result, calls } = await renderRow(2);

    await act(async () => {
      result.current.effects.changeReps(12);
      result.current.effects.changeWeight(62.5);
      result.current.effects.changeRpe(8);
      result.current.effects.remove();
    });

    expect(calls).toEqual([
      ['reps', 2, 12],
      ['weight', 2, 62.5],
      ['rpe', 2, 8],
      ['remove', 2],
    ]);
  });

  it.each([
    [
      'en',
      {
        title: 'Set 2',
        reps: 'Set 2 reps',
        weight: 'Set 2 weight in kg',
        rpe: 'Set 2 target RPE',
        remove: 'Remove set 2',
      },
    ],
    [
      'it',
      {
        title: 'Serie 2',
        reps: 'Ripetizioni della serie 2',
        weight: 'Peso della serie 2 in kg',
        rpe: 'RPE obiettivo della serie 2',
        remove: 'Rimuovi la serie 2',
      },
    ],
  ] as const)('names every control after its set, counted from one, in %s', async (language, labels) => {
    setLanguagePreference(language);

    const { result, unmount } = await renderRow(1);

    expect(result.current.derived.labels).toEqual(labels);
    await unmount();
  });
});
