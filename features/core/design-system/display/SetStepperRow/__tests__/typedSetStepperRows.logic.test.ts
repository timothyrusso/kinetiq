import { act, renderHook } from '@testing-library/react-native';
import { useDurationSetStepperRowLogic } from '@/features/core/design-system/display/SetStepperRow/DurationSetStepperRow.logic';
import { useRepsSetStepperRowLogic } from '@/features/core/design-system/display/SetStepperRow/RepsSetStepperRow.logic';
import { setLanguagePreference } from '@/features/core/translations';

const recorder = () => {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  return { calls, record };
};

describe('useRepsSetStepperRowLogic', () => {
  afterEach(() => setLanguagePreference('system'));

  it('hands its own index to its reps, RPE and remove writers', async () => {
    const { calls, record } = recorder();
    const { result } = await renderHook(() =>
      useRepsSetStepperRowLogic({
        index: 3,
        rpeKind: 'target',
        completed: false,
        onReps: record('reps'),
        onRpe: record('rpe'),
        onRemove: record('remove'),
      }),
    );

    await act(async () => {
      result.current.effects.changeReps(15);
      result.current.effects.changeRpe(7);
      result.current.effects.remove();
    });

    expect(calls).toEqual([
      ['reps', 3, 15],
      ['rpe', 3, 7],
      ['remove', 3],
    ]);
  });

  it.each([
    ['en', { title: 'Set 1', reps: 'Set 1 reps', rpeLabel: 'Target RPE' }],
    ['it', { title: 'Serie 1', reps: 'Ripetizioni della serie 1', rpeLabel: 'RPE obiettivo' }],
  ] as const)('names its controls after its set, in %s', async (language, labels) => {
    setLanguagePreference(language);
    const { record } = recorder();

    const { result, unmount } = await renderHook(() =>
      useRepsSetStepperRowLogic({
        index: 0,
        rpeKind: 'target',
        completed: false,
        onReps: record('reps'),
        onRpe: record('rpe'),
        onRemove: record('remove'),
      }),
    );

    expect(result.current.derived.labels).toMatchObject(labels);
    expect(result.current.derived.labels).not.toHaveProperty('weight');
    await unmount();
  });
});

describe('useDurationSetStepperRowLogic', () => {
  afterEach(() => setLanguagePreference('system'));

  it('hands its own index to its time, RPE and remove writers', async () => {
    const { calls, record } = recorder();
    const { result } = await renderHook(() =>
      useDurationSetStepperRowLogic({
        index: 1,
        rpeKind: 'logged',
        completed: true,
        onDuration: record('duration'),
        onRpe: record('rpe'),
        onRemove: record('remove'),
      }),
    );

    await act(async () => {
      result.current.effects.changeDuration(65);
      result.current.effects.changeRpe(9);
      result.current.effects.remove();
    });

    expect(calls).toEqual([
      ['duration', 1, 65],
      ['rpe', 1, 9],
      ['remove', 1],
    ]);
  });

  it.each([
    ['en', { titleA11y: 'Set 2, done', duration: 'Set 2 time in seconds', rpe: 'Set 2 RPE' }],
    ['it', { titleA11y: 'Serie 2, fatta', duration: 'Tempo della serie 2 in secondi', rpe: 'RPE della serie 2' }],
  ] as const)('says its time is in seconds, in %s', async (language, labels) => {
    setLanguagePreference(language);
    const { record } = recorder();

    const { result, unmount } = await renderHook(() =>
      useDurationSetStepperRowLogic({
        index: 1,
        rpeKind: 'logged',
        completed: true,
        onDuration: record('duration'),
        onRpe: record('rpe'),
        onRemove: record('remove'),
      }),
    );

    expect(result.current.derived.labels).toMatchObject(labels);
    await unmount();
  });
});
