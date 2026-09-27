import { act, waitFor } from '@testing-library/react-native';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import {
  type PickExercisePageProps,
  usePickExercisePageLogic,
} from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

const BENCH = anExercise();
const SQUAT = anExercise({ id: 'wger:13', externalId: 13, name: 'Squat', category: 'Legs' });
const ROWS = Array.from({ length: 30 }, (_, i) =>
  anExercise({ id: `wger:${100 + i}`, externalId: 100 + i, name: `Curl ${i}` }),
);

const renderPicker = (picked: Exercise[] = []) => {
  const props: PickExercisePageProps = {
    onPick: exercise => void picked.push(exercise),
    isIncluded: id => id === SQUAT.id,
    error: null,
  };
  return renderWithCatalog(usePickExercisePageLogic, { exercises: [BENCH, SQUAT, ...ROWS] }, props);
};

describe('usePickExercisePageLogic', () => {
  it('shows the first 24 rows and counts the ones already in the list', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));
    expect(result.current.state.total).toBe(32);
    expect(result.current.derived.includedCount).toBe(1);
    await done();
  });

  it('narrows the rows to the search term once typing settles', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    await act(async () => result.current.effects.setQuery('squat'));

    await waitFor(() => expect(result.current.state.rows.map(row => row.id)).toEqual([SQUAT.id]));
    expect(result.current.derived.searching).toBe(true);
    await done();
  });

  it('shows another 24 rows on Load more', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    await act(async () => result.current.effects.loadMore());

    await waitFor(() => expect(result.current.state.rows).toHaveLength(32));
    await done();
  });

  it('offers Load more while rows already read are still hidden', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    expect(result.current.state.hasMore).toBe(true);
    await done();
  });

  it('stops offering Load more once every matching row is shown', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    await act(async () => result.current.effects.loadMore());

    await waitFor(() => expect(result.current.state.rows).toHaveLength(32));
    expect(result.current.state.hasMore).toBe(false);
    await done();
  });

  it('hands the chosen row to onPick', async () => {
    const picked: Exercise[] = [];
    const { result, done } = await renderPicker(picked);
    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    await act(async () => result.current.effects.select(BENCH.id));

    expect(picked).toEqual([BENCH]);
    await done();
  });

  it('toggles a muscle filter on and off', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(24));

    await act(async () => result.current.effects.toggleMuscle(4));
    expect(result.current.state.muscleId).toBe(4);
    expect(result.current.derived.filtered).toBe(true);
    await act(async () => result.current.effects.toggleMuscle(4));

    expect(result.current.state.muscleId).toBeNull();
    await done();
  });
});
