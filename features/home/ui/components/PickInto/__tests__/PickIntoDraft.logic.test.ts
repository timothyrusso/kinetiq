import { act } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { aSquat } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer } from '@/features/home/di/__tests__/homeTestLayer';
import { usePickIntoDraftLogic } from '@/features/home/ui/components/PickInto/PickIntoDraft.logic';
import { useRoutineDraft } from '@/features/routines';

beforeEach(() => {
  resetAllStores();
});

const usePicker = () => ({ picker: usePickIntoDraftLogic(), draft: useRoutineDraft() });

describe('usePickIntoDraftLogic', () => {
  it('adds a picked exercise to the builder draft, which then includes it', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, usePicker, undefined);

    await act(async () => result.current.picker.effects.pick(aSquat()));

    expect(result.current.draft.draft.items.map(item => item.exerciseName)).toEqual(['Squat']);
    expect(result.current.picker.effects.isIncluded('wger:13')).toBe(true);
    await done();
  });

  it('includes nothing in an empty draft', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, usePicker, undefined);

    expect(result.current.picker.effects.isIncluded('wger:13')).toBe(false);
    await done();
  });
});
