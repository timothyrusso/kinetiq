import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aPlan } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer } from '@/features/home/di/__tests__/homeTestLayer';
import { useLiveResumeCardLogic } from '@/features/home/ui/components/ResumeCard/LiveResumeCard.logic';
import { useActiveSession, useStartSession } from '@/features/workouts';

beforeEach(() => {
  resetAllStores();
});

const useCard = () => ({ card: useLiveResumeCardLogic(), live: useActiveSession(), starter: useStartSession() });

describe('useLiveResumeCardLogic', () => {
  it('shows no card while no workout is running', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, useCard, undefined);

    expect(result.current.card.derived.card).toBeNull();
    await done();
  });

  it('shows the running workout with its sets done out of its total', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, useCard, undefined);

    await act(async () => result.current.starter.start(aPlan()));

    await waitFor(() => expect(result.current.card.derived.card).not.toBeNull());
    expect(result.current.card.derived.card).toMatchObject({ name: 'Push Day', paused: false, progress: 0 });
    expect(result.current.card.derived.card?.progressLabel).toBe('0%');
    expect(result.current.card.derived.card?.accessibilityLabel).toBe(
      tr('workoutTab.resumeA11y', { name: 'Push Day', done: 0, total: 3 }),
    );
    await done();
  });
});
