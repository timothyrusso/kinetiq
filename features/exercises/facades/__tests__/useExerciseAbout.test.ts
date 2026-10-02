import { waitFor } from '@testing-library/react-native';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { useExerciseAbout } from '@/features/exercises/facades/useExerciseAbout';
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

const useAbout = (exerciseId: string | null) => ({ about: useExerciseAbout(exerciseId) });

/** Renders the block over a catalog with no rows and `snapshot` stored, as a routine leaves it. */
const renderAbout = (snapshot = HIP_THRUST) =>
  renderWithLayer(makeCatalogReadsFake({ exercises: [] }, [snapshot]), useAbout, snapshot.exerciseId);

describe('useExerciseAbout', () => {
  it('shows the stored exercise’s bundled picture and trimmed steps', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.steps).not.toBeNull());
    expect(result.current.about.steps).toEqual(['Drive through the heels.', 'Squeeze at the top.']);
    expect(result.current.about.image).not.toBeNull();
    await done();
  });

  it('keeps a stored copy, which has no end frame, a still', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.image).not.toBeNull());
    expect(result.current.about.imageEnd).toBeNull();
    await done();
  });

  it('names the exercise in the photo’s and the link’s labels', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.isLoading).toBe(false));
    expect(result.current.about.openLabel).toBe(tr('exerciseDetail.openA11y', { name: 'Hip Thrust' }));
    expect(result.current.about.imageLabel).toBe(tr('itemEditor.imageA11y', { name: 'Hip Thrust' }));
    await done();
  });

  it('reads nothing while there is no exercise', async () => {
    const { result, done } = await renderWithLayer(makeCatalogReadsFake({ exercises: [] }), useAbout, null);

    expect(result.current.about).toMatchObject({ isLoading: false, image: null, steps: null });
    await done();
  });

  it('shows no picture for an image path this build does not bundle', async () => {
    const { result, done } = await renderAbout({
      ...HIP_THRUST,
      imageUrl: 'https://example.com/hip.png',
      thumbnailUrl: null,
    });

    await waitFor(() => expect(result.current.about.steps).not.toBeNull());
    expect(result.current.about.image).toBeNull();
    await done();
  });

  it('says a built-in exercise has no stored description instead of hiding it', async () => {
    const { result, done } = await renderAbout({ ...HIP_THRUST, instructions: [] });

    await waitFor(() => expect(result.current.about.isLoading).toBe(false));
    expect(result.current.about.steps).toBeNull();
    expect(result.current.about.fallback).toBe(tr('exerciseDetail.unknownBuiltIn'));
    await done();
  });
});
