import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { useExerciseAboutLogic } from '@/features/exercises/ui/components/ExerciseAbout/ExerciseAbout.logic';
import { makeCatalogReadsFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

const HIP_THRUST: ExerciseSnapshot = {
  exerciseId: 'local:hip-thrust',
  name: 'Hip Thrust',
  instructions: ['  Drive through the heels.  ', 'Squeeze at the top.'],
  category: 'Glutes',
  primaryMuscles: ['Glutes'],
  secondaryMuscles: [],
  equipment: ['Barbell'],
  imageUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/0.webp',
  thumbnailUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/thumb.webp',
  capturedAt: 1_700_000_000_000,
};

const useAbout = (exerciseId: string) => ({ about: useExerciseAboutLogic(exerciseId) });

/** Renders the block over a catalog with no rows and `snapshot` stored, as a routine leaves it. */
const renderAbout = (snapshot = HIP_THRUST) =>
  renderWithLayer(makeCatalogReadsFake({ exercises: [] }, [snapshot]), useAbout, snapshot.exerciseId);

describe('useExerciseAboutLogic', () => {
  it('shows the stored exercise’s bundled picture and trimmed steps', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.derived.steps).not.toBeNull());
    expect(result.current.about.derived.steps).toEqual(['Drive through the heels.', 'Squeeze at the top.']);
    expect(result.current.about.derived.image).not.toBeNull();
    await done();
  });

  it('keeps a stored copy, which has no end frame, a still', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.derived.image).not.toBeNull());
    expect(result.current.about.derived.imageEnd).toBeNull();
    expect(result.current.about.state.animating).toBe(true);
    await done();
  });

  it('opens the exercise page for its exercise', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.state.isLoading).toBe(false));
    await act(async () => result.current.about.effects.open());
    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.exerciseDetail('local:hip-thrust', true) }]);
    expect(result.current.about.derived.openLabel).toBe(tr('exerciseDetail.openA11y', { name: 'Hip Thrust' }));
    await done();
  });

  it('shows no picture for an image path this build does not bundle', async () => {
    const { result, done } = await renderAbout({
      ...HIP_THRUST,
      imageUrl: 'https://example.com/hip.png',
      thumbnailUrl: null,
    });

    await waitFor(() => expect(result.current.about.derived.steps).not.toBeNull());
    expect(result.current.about.derived.image).toBeNull();
    await done();
  });

  it('says a built-in exercise has no stored description instead of hiding it', async () => {
    const { result, done } = await renderAbout({ ...HIP_THRUST, instructions: [] });

    await waitFor(() => expect(result.current.about.state.isLoading).toBe(false));
    expect(result.current.about.derived.steps).toBeNull();
    expect(result.current.about.derived.fallback).toBe(tr('exerciseDetail.unknownBuiltIn'));
    await done();
  });
});
