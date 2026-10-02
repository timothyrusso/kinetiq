import { act, renderHook } from '@testing-library/react-native';
import {
  type SetRpeKind,
  useSetStepperRowLogic,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperRow.logic';
import { setLanguagePreference } from '@/features/core/translations';

const renderRow = async (index = 1, rpeKind: SetRpeKind = 'target', completed = false) => {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  const rendered = await renderHook(() =>
    useSetStepperRowLogic({
      index,
      unit: 'kg',
      rpeKind,
      completed,
      onReps: record('reps'),
      onWeight: record('weight'),
      onRpe: record('rpe'),
      onRemove: record('remove'),
    }),
  );
  return { ...rendered, calls };
};

describe('useSetStepperRowLogic', () => {
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
        titleA11y: 'Set 2',
        reps: 'Set 2 reps',
        weight: 'Set 2 weight in kg',
        rpeLabel: 'Target RPE',
        rpe: 'Set 2 target RPE',
        remove: 'Remove set 2',
      },
    ],
    [
      'it',
      {
        title: 'Serie 2',
        titleA11y: 'Serie 2',
        reps: 'Ripetizioni della serie 2',
        weight: 'Peso della serie 2 in kg',
        rpeLabel: 'RPE obiettivo',
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

  it.each([
    ['en', { titleA11y: 'Set 2, done', rpeLabel: 'RPE', rpe: 'Set 2 RPE' }],
    ['it', { titleA11y: 'Serie 2, fatta', rpeLabel: 'RPE', rpe: 'RPE della serie 2' }],
  ] as const)('says a logged set is done and names its effort without a target, in %s', async (language, labels) => {
    setLanguagePreference(language);

    const { result, unmount } = await renderRow(1, 'logged', true);

    expect(result.current.derived.labels).toMatchObject(labels);
    await unmount();
  });
});
