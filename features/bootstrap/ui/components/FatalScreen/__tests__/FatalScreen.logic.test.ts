import { act, waitFor } from '@testing-library/react-native';
import { CoreOnly, routineCount, seedRoutine } from '@/features/bootstrap/di/__tests__/bootstrapTestData';
import { useFatalScreenLogic } from '@/features/bootstrap/ui/components/FatalScreen/FatalScreen.logic';
import { renderWithLayer } from '@/features/core/testing';

const launches = { count: 0 };
const relaunch = () => {
  launches.count += 1;
};

beforeEach(() => {
  launches.count = 0;
});

/** The screen over a migrated database holding one routine. */
const renderScreen = async () => {
  const rendered = await renderWithLayer(CoreOnly, useFatalScreenLogic, relaunch);
  await rendered.runtime.runPromise(seedRoutine);
  return { ...rendered, routines: () => rendered.runtime.runPromise(routineCount) };
};

describe('useFatalScreenLogic', () => {
  it('asks before erasing anything', async () => {
    const { result, routines, done } = await renderScreen();

    await act(async () => result.current.effects.askReset());

    expect(result.current.state.confirmingReset).toBe(true);
    expect(await routines()).toBe(1);
    await done();
  });

  it('keeps the data and launches nothing when the user backs out', async () => {
    const { result, routines, done } = await renderScreen();

    await act(async () => result.current.effects.askReset());
    await act(async () => result.current.effects.keepData());

    expect(result.current.state.confirmingReset).toBe(false);
    expect(await routines()).toBe(1);
    expect(launches.count).toBe(0);
    await done();
  });

  it('erases the local data and launches again on confirm', async () => {
    const { result, routines, done } = await renderScreen();

    await act(async () => result.current.effects.askReset());
    await act(async () => result.current.effects.confirmReset());

    await waitFor(() => expect(launches.count).toBe(1));
    expect(await routines()).toBe(0);
    expect(result.current.state.resetFailed).toBe(false);
    await done();
  });
});
