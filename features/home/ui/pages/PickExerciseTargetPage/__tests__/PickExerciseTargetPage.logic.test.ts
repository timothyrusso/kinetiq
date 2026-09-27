import { renderHook } from '@testing-library/react-native';
import { routerFake } from '@/features/core/testing';
import { usePickExerciseTargetPageLogic } from '@/features/home/ui/pages/PickExerciseTargetPage/PickExerciseTargetPage.logic';

describe('usePickExerciseTargetPageLogic', () => {
  it('picks into the saved routine the route names', async () => {
    routerFake.setParams({ target: 'routine', id: 'rtn_push' });

    const { result } = await renderHook(usePickExerciseTargetPageLogic);

    expect(result.current.state).toEqual({ routineId: 'rtn_push', intoSession: false });
  });

  it('picks into the workout in progress for the session target', async () => {
    routerFake.setParams({ target: 'session' });

    const { result } = await renderHook(usePickExerciseTargetPageLogic);

    expect(result.current.state).toEqual({ routineId: null, intoSession: true });
  });

  it('picks into the builder draft when the route names neither', async () => {
    routerFake.setParams({ target: 'draft' });

    const { result } = await renderHook(usePickExerciseTargetPageLogic);

    expect(result.current.state).toEqual({ routineId: null, intoSession: false });
  });

  it('falls back to the draft for a routine target with no id', async () => {
    routerFake.setParams({ target: 'routine' });

    const { result } = await renderHook(usePickExerciseTargetPageLogic);

    expect(result.current.state).toEqual({ routineId: null, intoSession: false });
  });
});
