import { act, waitFor } from '@testing-library/react-native';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import { useExerciseSearch } from '@/features/exercises/facades/useExerciseSearch';
import type { makeCatalogRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

const PRESSES = Array.from({ length: 120 }, (_, i) =>
  anExercise({ id: `wger:${i + 1}`, externalId: i + 1, name: `Press ${String(i + 1).padStart(3, '0')}` }),
);
const PRESS: ExerciseFilter = { query: 'press', categoryId: null, equipmentId: null, muscleId: null };
const PRESS_0: ExerciseFilter = { ...PRESS, query: 'press 0' };

const renderSearch = (options: Parameters<typeof makeCatalogRepositoryFake>[0], filter = PRESS) =>
  renderWithCatalog(({ current }: { current: ExerciseFilter }) => useExerciseSearch(current), options, {
    current: filter,
  });

describe('useExerciseSearch', () => {
  it('reads the first page of 50 rows, with the total and more to come', async () => {
    const { result, done } = await renderSearch({ exercises: PRESSES });

    await waitFor(() => expect(result.current.items).toHaveLength(50));
    expect(result.current.total).toBe(120);
    expect(result.current.hasMore).toBe(true);
    await done();
  });

  it('widens the read by a page on each loadNextPage, until the total is reached', async () => {
    const { result, done } = await renderSearch({ exercises: PRESSES });
    await waitFor(() => expect(result.current.items).toHaveLength(50));

    await act(async () => result.current.loadNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(100));
    await act(async () => result.current.loadNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(120));

    expect(result.current.items.map(item => item.id)).toEqual(PRESSES.map(item => item.id));
    expect(result.current.hasMore).toBe(false);
    await done();
  });

  it('starts a new filter from the first page', async () => {
    const { result, rerender, done } = await renderSearch({ exercises: PRESSES });
    await waitFor(() => expect(result.current.items).toHaveLength(50));
    await act(async () => result.current.loadNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(100));

    await rerender({ current: PRESS_0 });

    await waitFor(() => expect(result.current.total).toBe(99));
    expect(result.current.items).toHaveLength(50);
    expect(result.current.isPlaceholder).toBe(false);
    await done();
  });

  it('reports a failed read as its tagged error, logged once', async () => {
    const { result, logs, done } = await renderSearch({ failingReads: true });

    await waitFor(() => expect(result.current.error?._tag).toBe('SqlError'));
    expect(result.current.items).toEqual([]);
    expect(logs.entries.map(entry => [entry.level, entry.message])).toEqual([['warn', 'SqlError']]);
    await done();
  });
});
