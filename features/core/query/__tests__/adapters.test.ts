import { AppState } from 'react-native';
import { setupQueryAdapters } from '@/features/core/query/adapters';

const managers = () => {
  const state = { focused: null as boolean | null, online: null as boolean | null };
  return {
    state,
    focus: {
      setFocused: (focused?: boolean) => {
        state.focused = focused ?? null;
      },
    },
    online: {
      setOnline: (online: boolean) => {
        state.online = online;
      },
    },
  };
};

describe('setupQueryAdapters', () => {
  it('seeds focus from the app state now', () => {
    const { state, focus, online } = managers();

    const adapters = setupQueryAdapters(focus, online);

    expect(state.focused).toBe(AppState.currentState === 'active');
    adapters.dispose();
  });

  it('seeds the connection as online until the probe answers', () => {
    const { state, focus, online } = managers();

    const adapters = setupQueryAdapters(focus, online);

    expect(state.online).toBe(true);
    adapters.dispose();
  });

  it('leaves both managers focused and online once disposed', () => {
    const { state, focus, online } = managers();
    const adapters = setupQueryAdapters(focus, online);
    focus.setFocused(false);
    online.setOnline(false);

    adapters.dispose();

    expect(state).toEqual({ focused: true, online: true });
  });
});
