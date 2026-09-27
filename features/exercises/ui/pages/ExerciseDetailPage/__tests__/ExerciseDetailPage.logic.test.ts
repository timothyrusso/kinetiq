import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import { useExerciseDetailPageLogic } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.logic';

const BENCH = anExercise();

const renderDetail = (id?: string) => {
  if (id !== undefined) routerFake.setParams({ id });
  return renderWithCatalog(useExerciseDetailPageLogic, { exercises: [BENCH] }, undefined);
};

describe('useExerciseDetailPageLogic', () => {
  it('titles the screen with the catalog exercise and offers its wger page', async () => {
    const { result, done } = await renderDetail(BENCH.id);

    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));
    expect(result.current.derived.title).toBe(BENCH.name);
    expect(result.current.derived.hasExternalPage).toBe(true);
    await done();
  });

  it('titles a screen with no exercise id with the fallback title', async () => {
    const { result, done } = await renderDetail();

    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    expect(result.current.derived.title).toBe(tr('exerciseDetail.fallbackTitle'));
    await done();
  });

  it('opens a variation, and not the exercise already on screen', async () => {
    const { result, done } = await renderDetail(BENCH.id);
    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));

    await act(async () => result.current.effects.openVariation(BENCH.id));
    await act(async () => result.current.effects.openVariation('wger:13'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.exerciseDetail('wger:13') }]);
    await done();
  });

  it('goes Home when there is nothing to go back to', async () => {
    routerFake.setCanGoBack(false);
    const { result, done } = await renderDetail('wger:999');

    await act(async () => result.current.effects.goBack());

    expect(routerFake.history).toEqual([{ verb: 'replace', href: routes.home() }]);
    await done();
  });
});
