import { waitFor } from '@testing-library/react-native';
import { renderWithLayer } from '@/features/core/testing';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import { useExercise } from '@/features/exercises/facades/useExercise';
import { makeCatalogReadsFake } from '@/features/exercises/useCases/__tests__/catalogFakes';
import { updateSettings } from '@/features/settings';

const BENCH = anExercise();

afterEach(() => updateSettings({ language: 'system' }));

describe('useExercise', () => {
  it('reads a catalog exercise from the catalog', async () => {
    const { result, done } = await renderWithCatalog(useExercise, { exercises: [BENCH] }, BENCH.id);

    await waitFor(() => expect(result.current.exercise).toEqual(BENCH));
    expect(result.current.from).toBe('catalog');
    await done();
  });

  it('answers an exercise the catalog has retired as unknown, logging nothing', async () => {
    const { result, logs, done } = await renderWithCatalog(useExercise, { exercises: [BENCH] }, 'wger:999');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.exercise).toBeNull();
    expect(result.current.error).toBeNull();
    expect(logs.entries).toEqual([]);
    await done();
  });

  it('answers a local exercise with no stored copy as unknown, logging nothing', async () => {
    const { result, logs, done } = await renderWithCatalog(useExercise, { exercises: [BENCH] }, 'local:hip-thrust');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.from).toBe('none');
    expect(logs.entries).toEqual([]);
    await done();
  });

  it('names the muscles and equipment of a stored exercise picked in Italian in the language of the app', async () => {
    updateSettings({ language: 'en' });
    const retired = anExercise({
      id: 'wger:999',
      externalId: 999,
      name: 'Panca piana',
      category: 'Petto',
      primaryMuscles: ['Petto'],
      secondaryMuscles: ['Tricipiti'],
      equipment: ['Bilanciere'],
    });
    const layer = makeCatalogReadsFake({ exercises: [BENCH] }, [snapshotOf(retired, 0)]);
    const { result, done } = await renderWithLayer(layer, useExercise, retired.id);

    await waitFor(() => expect(result.current.from).toBe('stored'));
    expect(result.current.exercise).toMatchObject({
      name: 'Panca piana',
      category: 'Chest',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps'],
      equipment: ['Barbell'],
    });
    expect(result.current.stored?.primaryMuscles).toEqual(['Chest']);
    await done();
  });
});
