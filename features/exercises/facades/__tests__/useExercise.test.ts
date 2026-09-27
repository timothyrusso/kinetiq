import { waitFor } from '@testing-library/react-native';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import { useExercise } from '@/features/exercises/facades/useExercise';

const BENCH = anExercise();

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
});
