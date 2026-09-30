import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anExercise, aPlan, aSquat } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer } from '@/features/home/di/__tests__/homeTestLayer';
import { usePickIntoSessionLogic } from '@/features/home/ui/components/PickInto/PickIntoSession.logic';
import { useActiveSession, useStartSession } from '@/features/workouts';

beforeEach(() => {
  resetAllStores();
});

const usePicker = () => ({ picker: usePickIntoSessionLogic(), live: useActiveSession(), starter: useStartSession() });

/** Renders the picker over a live push day with the bench press in it. */
const renderPicker = async () => {
  const rendered = await renderWithLayer(HomeTestLayer, usePicker, undefined);
  await act(async () => rendered.result.current.starter.start(aPlan()));
  await waitFor(() => expect(rendered.result.current.live.session).not.toBeNull());
  return rendered;
};

describe('usePickIntoSessionLogic', () => {
  it('adds a picked exercise to the workout and makes it the current one', async () => {
    const { result, done } = await renderPicker();

    await act(async () => result.current.picker.effects.pick(aSquat()));

    await waitFor(() =>
      expect(result.current.live.session?.entries.map(entry => entry.exerciseName)).toEqual(['Bench Press', 'Squat']),
    );
    expect(result.current.live.session?.activeIndex).toBe(1);
    expect(result.current.picker.state.error).toBeNull();
    await done();
  });

  it('says nothing changed for an exercise already in the workout, and keeps one of it', async () => {
    const { result, done } = await renderPicker();

    await act(async () => result.current.picker.effects.pick(anExercise()));

    await waitFor(() => expect(result.current.picker.state.error).toBe(tr('session.addNotChanged')));
    expect(result.current.live.session?.entries).toHaveLength(1);
    await done();
  });

  it('says nothing changed when no workout is running', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, usePicker, undefined);

    await act(async () => result.current.picker.effects.pick(aSquat()));

    await waitFor(() => expect(result.current.picker.state.error).toBe(tr('session.addNotChanged')));
    expect(result.current.live.session).toBeNull();
    await done();
  });

  it('marks the exercises already in the workout as included', async () => {
    const { result, done } = await renderPicker();

    expect(result.current.picker.effects.isIncluded('wger:73')).toBe(true);
    expect(result.current.picker.effects.isIncluded('wger:13')).toBe(false);
    await done();
  });

  it('names the workout in the picker footer when picking into the live workout', async () => {
    const { result, done } = await renderPicker();

    expect(result.current.picker.state.destination).toBe('workout');
    await done();
  });
});
