import { act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { routes } from '@/features/core/navigation';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import { useExerciseDetailPageLogic } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.logic';
import { makeCatalogReadsFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

const BENCH = anExercise({ instructions: ['Lower the bar to the chest.', '  ', 'Press it back up.'] });

const STRETCH = anExercise({
  id: 'ex:90-90-hamstring',
  name: '90/90 Hamstring',
  trainingType: 'stretching',
  level: 'beginner',
  mechanic: null,
  instructions: [],
});

const PICTURED = anExercise({
  id: 'ex:barbell-squat',
  name: 'Barbell Squat',
  imageUrl: 'assets/catalog/images/barbell-squat/0.webp',
});

/** A stored copy from the previous catalog: its image is a URL this build does not bundle. */
const UNBUNDLED = anExercise({ id: 'ex:retired-press', imageUrl: 'https://example.com/press.png' });

const renderDetail = (id?: string, exercise = BENCH) => {
  if (id !== undefined) routerFake.setParams({ id });
  return renderWithCatalog(useExerciseDetailPageLogic, { exercises: [exercise] }, undefined);
};

describe('useExerciseDetailPageLogic', () => {
  it('titles the screen with the catalog exercise and lists its non-blank steps in order', async () => {
    const { result, done } = await renderDetail(BENCH.id);

    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));
    expect(result.current.derived.title).toBe(BENCH.name);
    expect(result.current.derived.steps).toEqual(['Lower the bar to the chest.', 'Press it back up.']);
    await done();
  });

  it('badges the level and mechanic, and no training type for a strength exercise', async () => {
    const { result, done } = await renderDetail(BENCH.id);

    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));
    expect(result.current.derived.badgeTags.map(tag => tag.label)).toEqual([
      tr('exerciseLevels.beginner'),
      tr('exerciseMechanics.compound'),
    ]);
    expect(result.current.derived.hasLead).toBe(true);
    await done();
  });

  it('gives a stored exercise no lead line when it has no badges', async () => {
    const retired = anExercise({ id: 'legacy:999', level: null, mechanic: null });
    routerFake.setParams({ id: retired.id });
    const layer = makeCatalogReadsFake({ exercises: [] }, [snapshotOf(retired, 0)]);
    const { result, done } = await renderWithLayer(layer, useExerciseDetailPageLogic, undefined);

    await waitFor(() => expect(result.current.state.from).toBe('stored'));
    expect(result.current.derived.hasLead).toBe(false);
    await done();
  });

  it('badges a stretching exercise as one, and keeps the fallback for no steps', async () => {
    const { result, done } = await renderDetail(STRETCH.id, STRETCH);

    await waitFor(() => expect(result.current.state.exercise).toEqual(STRETCH));
    expect(result.current.derived.badgeTags.map(tag => tag.label)).toEqual([
      tr('exerciseTrainingTypes.stretching'),
      tr('exerciseLevels.beginner'),
    ]);
    expect(result.current.derived.steps).toBeNull();
    await done();
  });

  it('titles an exercise it has not read yet by its slug', async () => {
    const { result, done } = await renderDetail('ex:barbell-squat', BENCH);

    expect(result.current.derived.title).toBe('Barbell Squat');
    await done();
  });

  it('titles a screen with no exercise id with the fallback title', async () => {
    const { result, done } = await renderDetail();

    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    expect(result.current.derived.title).toBe(tr('exerciseDetail.fallbackTitle'));
    await done();
  });

  it('opens a similar exercise', async () => {
    const { result, done } = await renderDetail(BENCH.id);
    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));

    await act(async () => result.current.effects.openSimilar('ex:barbell-squat'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.exerciseDetail('ex:barbell-squat') }]);
    await done();
  });

  it('opened over a sheet on iOS, carries a Done that goes back, and opens similar ones the same way', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    routerFake.setParams({ id: BENCH.id, sheet: '1' });
    const { result, done } = await renderWithCatalog(useExerciseDetailPageLogic, { exercises: [BENCH] }, undefined);
    await waitFor(() => expect(result.current.state.exercise).toEqual(BENCH));

    expect(result.current.derived.closable).toBe(true);
    await act(async () => result.current.effects.close());
    await act(async () => result.current.effects.openSimilar('ex:barbell-squat'));

    expect(routerFake.history).toEqual([
      { verb: 'back', href: null },
      { verb: 'push', href: routes.exerciseDetail('ex:barbell-squat', true) },
    ]);
    await done();
  });

  it('has no Done when pushed as a card, or on Android, where the back arrow is there', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const card = await renderDetail(BENCH.id);
    expect(card.result.current.derived.closable).toBe(false);
    await card.done();

    jest.replaceProperty(Platform, 'OS', 'android');
    routerFake.setParams({ id: BENCH.id, sheet: '1' });
    const android = await renderWithCatalog(useExerciseDetailPageLogic, { exercises: [BENCH] }, undefined);
    expect(android.result.current.derived.closable).toBe(false);
    await android.done();
  });

  it('goes Home when there is nothing to go back to', async () => {
    routerFake.setCanGoBack(false);
    const { result, done } = await renderDetail('ex:no-such-exercise');

    await act(async () => result.current.effects.goBack());

    expect(routerFake.history).toEqual([{ verb: 'replace', href: routes.home() }]);
    await done();
  });

  it('floats the header over the art on iOS, where the bar blurs what scrolls under it', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { result, done } = await renderDetail(PICTURED.id, PICTURED);

    await waitFor(() => expect(result.current.state.exercise).toEqual(PICTURED));
    expect(result.current.derived.transparent).toBe(true);
    await done();
  });

  it('keeps the opaque header for an image this build does not bundle', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { result, done } = await renderDetail(UNBUNDLED.id, UNBUNDLED);

    await waitFor(() => expect(result.current.state.exercise).toEqual(UNBUNDLED));
    expect(result.current.derived.transparent).toBe(false);
    await done();
  });

  it('keeps the opaque header on Android, which has no blur for the content to scroll under', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result, done } = await renderDetail(PICTURED.id, PICTURED);

    await waitFor(() => expect(result.current.state.exercise).toEqual(PICTURED));
    expect(result.current.derived.transparent).toBe(false);
    await done();
  });
});
