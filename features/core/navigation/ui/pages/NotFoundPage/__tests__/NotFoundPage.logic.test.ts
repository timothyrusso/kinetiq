import { act, renderHook } from '@testing-library/react-native';
import { tabHref } from '@/features/core/navigation/nav';
import { useNotFoundPageLogic } from '@/features/core/navigation/ui/pages/NotFoundPage/NotFoundPage.logic';
import { routerFake } from '@/features/core/testing';

describe('useNotFoundPageLogic', () => {
  it('names the path that did not match', async () => {
    routerFake.setPathname('/routine/gone');

    const { result } = await renderHook(useNotFoundPageLogic);

    expect(result.current.state.detail).toBe('/routine/gone');
  });

  it('offers Home and Back when there is somewhere to go back to', async () => {
    const { result } = await renderHook(useNotFoundPageLogic);

    expect(result.current.derived.actions.map(action => action.key)).toEqual(['home', 'back']);
  });

  it('offers only Home when there is nothing to go back to', async () => {
    routerFake.setCanGoBack(false);

    const { result } = await renderHook(useNotFoundPageLogic);

    expect(result.current.derived.actions.map(action => action.key)).toEqual(['home']);
  });

  it('replaces the stack with Home rather than pushing onto it', async () => {
    const { result } = await renderHook(useNotFoundPageLogic);

    await act(async () => result.current.derived.actions[0]?.onPress());

    expect(routerFake.history).toEqual([{ verb: 'replace', href: tabHref(0) }]);
  });

  it('links to every tab', async () => {
    const { result } = await renderHook(useNotFoundPageLogic);

    await act(async () => result.current.derived.links[2]?.onPress());

    expect(result.current.derived.links).toHaveLength(3);
    expect(routerFake.history).toEqual([{ verb: 'replace', href: tabHref(2) }]);
  });
});
