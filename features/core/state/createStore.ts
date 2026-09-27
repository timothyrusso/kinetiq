import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand';

const resets = new Set<() => void>();

/**
 * A zustand store that registers for {@link resetAllStores}. Create each store once, at module
 * level, and expose it with `createSelectors`.
 */
export function createStore<T extends object>(initializer: StateCreator<T>): UseBoundStore<StoreApi<T>> {
  const store = create<T>()(initializer);
  const initial = store.getState();
  resets.add(() => store.setState(initial, true));
  return store;
}

/** Puts every store back to its initial state, between tests and on a data wipe. */
export function resetAllStores(): void {
  for (const reset of resets) reset();
}
