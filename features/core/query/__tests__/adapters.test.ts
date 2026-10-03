import { AppState, type AppStateStatus } from 'react-native';
import { setupQueryAdapters } from '@/features/core/query/adapters';

/** Fires the app-state listener the adapter registered last, through React Native's jest mock. */
const appStateChanged = (status: AppStateStatus) => jest.mocked(AppState.addEventListener).mock.lastCall?.[1](status);

const manager = () => {
  const state = { focused: null as boolean | null };
  return {
    state,
    focus: {
      setFocused: (focused?: boolean) => {
        state.focused = focused ?? null;
      },
    },
  };
};

describe('setupQueryAdapters', () => {
  it('seeds focus from the app state now', () => {
    const { state, focus } = manager();

    const adapters = setupQueryAdapters(focus);

    expect(state.focused).toBe(AppState.currentState === 'active');
    adapters.dispose();
  });

  it('follows the app in and out of the foreground', () => {
    const { state, focus } = manager();
    const adapters = setupQueryAdapters(focus);

    appStateChanged('background');
    const away = state.focused;
    appStateChanged('active');

    expect([away, state.focused]).toEqual([false, true]);
    adapters.dispose();
  });

  it('leaves the manager focused once disposed', () => {
    const { state, focus } = manager();
    const adapters = setupQueryAdapters(focus);
    focus.setFocused(false);

    adapters.dispose();

    expect(state.focused).toBe(true);
  });
});
