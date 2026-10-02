import { act, waitFor } from '@testing-library/react-native';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { renderWithCatalog } from '@/features/exercises/facades/__tests__/renderWithCatalog';
import {
  type PickExercisePageProps,
  usePickExercisePageLogic,
} from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

const BENCH = anExercise();
const SQUAT = anExercise({ id: 'ex:barbell-squat', name: 'Squat', category: 'Legs' });
const ROWS = Array.from({ length: 60 }, (_, i) => anExercise({ id: `ex:curl-${i}`, name: `Curl ${i}` }));

const renderPicker = (
  picked: Exercise[] = [],
  {
    exercises = [BENCH, SQUAT, ...ROWS],
    included = [SQUAT.id],
    destination = 'routine',
    unpicked,
  }: {
    exercises?: Exercise[];
    included?: string[];
    destination?: PickExercisePageProps['destination'];
    /** Where removals land; left out, the picker is add-only, as for the live workout. */
    unpicked?: string[];
  } = {},
) => {
  const props: PickExercisePageProps = {
    onPick: exercise => void picked.push(exercise),
    ...(unpicked === undefined ? {} : { onUnpick: (id: string) => void unpicked.push(id) }),
    isIncluded: id => included.includes(id),
    error: null,
    destination,
  };
  return renderWithCatalog(usePickExercisePageLogic, { exercises }, props);
};

describe('usePickExercisePageLogic', () => {
  it('shows the first catalog page and counts the ones already in the list', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));
    expect(result.current.state.total).toBe(62);
    expect(result.current.derived.includedCount).toBe(1);
    await done();
  });

  it('narrows the rows to the search term once typing settles', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.setQuery('squat'));

    await waitFor(() => expect(result.current.state.rows.map(row => row.id)).toEqual([SQUAT.id]));
    expect(result.current.derived.searching).toBe(true);
    await done();
  });

  it('reads the next catalog page on Load more', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.loadMore());

    await waitFor(() => expect(result.current.state.rows).toHaveLength(62));
    await done();
  });

  it('offers Load more while the catalog has more rows', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    expect(result.current.state.hasMore).toBe(true);
    await done();
  });

  it('stops offering Load more once every matching row is shown', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.loadMore());

    await waitFor(() => expect(result.current.state.rows).toHaveLength(62));
    expect(result.current.state.hasMore).toBe(false);
    await done();
  });

  it('hands the chosen row to onPick', async () => {
    const picked: Exercise[] = [];
    const { result, done } = await renderPicker(picked);
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.select(BENCH.id));

    expect(picked).toEqual([BENCH]);
    await done();
  });

  it('removes an included row on a second tap when the destination allows it', async () => {
    const picked: Exercise[] = [];
    const unpicked: string[] = [];
    const { result, done } = await renderPicker(picked, { unpicked });
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.select(SQUAT.id));

    expect(unpicked).toEqual([SQUAT.id]);
    expect(picked).toEqual([]);
    expect(result.current.derived.removable).toBe(true);
    await done();
  });

  it('leaves an included row alone when the destination is add-only', async () => {
    const picked: Exercise[] = [];
    const { result, done } = await renderPicker(picked, { destination: 'workout' });
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.select(SQUAT.id));

    expect(picked).toEqual([]);
    expect(result.current.derived.removable).toBe(false);
    await done();
  });

  it('still adds a row that is not included when removing is allowed', async () => {
    const picked: Exercise[] = [];
    const unpicked: string[] = [];
    const { result, done } = await renderPicker(picked, { unpicked });
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.select(BENCH.id));

    expect(picked).toEqual([BENCH]);
    expect(unpicked).toEqual([]);
    await done();
  });

  it('toggles a muscle filter on and off', async () => {
    const { result, done } = await renderPicker();
    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));

    await act(async () => result.current.effects.toggleMuscle('chest'));
    expect(result.current.state.muscleId).toBe('chest');
    expect(result.current.derived.filtered).toBe(true);
    await act(async () => result.current.effects.toggleMuscle('chest'));

    expect(result.current.state.muscleId).toBeNull();
    await done();
  });

  it('counts one exercise in the library in the singular', async () => {
    const { result, done } = await renderPicker([], { exercises: [BENCH], included: [] });

    await waitFor(() => expect(result.current.derived.libraryHint).toBe('1 exercise in the library'));
    await done();
  });

  it('counts the library in the plural', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.derived.libraryHint).toBe('62 exercises in the library'));
    await done();
  });

  it('says one exercise is already in this routine', async () => {
    const { result, done } = await renderPicker();

    await waitFor(() => expect(result.current.derived.includedNote).toBe('1 is already in this routine'));
    await done();
  });

  it('says how many are already in this routine in the plural', async () => {
    const { result, done } = await renderPicker([], { included: [BENCH.id, SQUAT.id] });

    await waitFor(() => expect(result.current.derived.includedNote).toBe('2 are already in this routine'));
    await done();
  });

  it('names the workout, not the routine, when picking into a live workout', async () => {
    const { result, done } = await renderPicker([], { destination: 'workout' });

    await waitFor(() => expect(result.current.derived.includedNote).toBe('1 is already in this workout'));
    await done();
  });

  it('counts the workout in the plural', async () => {
    const { result, done } = await renderPicker([], { destination: 'workout', included: [BENCH.id, SQUAT.id] });

    await waitFor(() => expect(result.current.derived.includedNote).toBe('2 are already in this workout'));
    await done();
  });

  it('shows no footer note while nothing picked is in the list', async () => {
    const { result, done } = await renderPicker([], { included: [] });

    await waitFor(() => expect(result.current.state.rows).toHaveLength(50));
    expect(result.current.derived.includedNote).toBeNull();
    await done();
  });
});
