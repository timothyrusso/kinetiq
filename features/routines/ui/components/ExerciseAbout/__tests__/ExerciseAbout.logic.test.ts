import { act, waitFor } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { anExerciseSnapshot, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { renderWithRoutines } from '@/features/routines/facades/__tests__/renderWithRoutines';
import { useSaveRoutine } from '@/features/routines/facades/useSaveRoutine';
import { useExerciseAboutLogic } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout.logic';

const HIP_THRUST = anExerciseSnapshot({
  exerciseId: 'local:hip-thrust',
  name: 'Hip Thrust',
  instructions: ['  Drive through the heels.  ', 'Squeeze at the top.'],
});

const useAbout = (exerciseId: string) => ({ about: useExerciseAboutLogic(exerciseId), save: useSaveRoutine() });

/** Stores `snapshot` the way the builder does: by saving a routine that uses it. */
const renderAbout = async (snapshot = HIP_THRUST) => {
  const rendered = await renderWithRoutines(useAbout, 'none');
  await act(async () => {
    await rendered.result.current.save.mutateAsync({
      name: 'Glutes',
      items: [aRoutineItem({ exerciseId: snapshot.exerciseId, exerciseName: snapshot.name })],
      snapshots: [snapshot],
    });
  });
  await rendered.rerender(snapshot.exerciseId);
  return rendered;
};

describe('useExerciseAboutLogic', () => {
  it('shows the stored exercise’s bundled picture and trimmed steps', async () => {
    const { result, done } = await renderAbout();

    await waitFor(() => expect(result.current.about.derived.described).toBe(true));
    expect(result.current.about.derived.description).toBe('Drive through the heels.\n\nSqueeze at the top.');
    expect(result.current.about.derived.image).not.toBeNull();
    await done();
  });

  it('shows no picture for an image path this build does not bundle', async () => {
    const { result, done } = await renderAbout({
      ...HIP_THRUST,
      imageUrl: 'https://example.com/hip.png',
      thumbnailUrl: null,
    });

    await waitFor(() => expect(result.current.about.derived.described).toBe(true));
    expect(result.current.about.derived.image).toBeNull();
    await done();
  });

  it('says a built-in exercise has no stored description instead of hiding it', async () => {
    const { result, done } = await renderAbout({ ...HIP_THRUST, instructions: [] });

    await waitFor(() => expect(result.current.about.state.isLoading).toBe(false));
    expect(result.current.about.derived.described).toBe(false);
    expect(result.current.about.derived.description).toBe(tr('exerciseDetail.unknownBuiltIn'));
    await done();
  });
});
