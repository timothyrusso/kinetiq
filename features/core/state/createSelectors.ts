import type { StoreApi, UseBoundStore } from 'zustand';

/** One hook per key of the state, each subscribing to that key alone. */
type Selectors<T> = { readonly [K in keyof T]: () => T[K] };

/** The store, plus `use.<key>()` selector hooks. */
export type WithSelectors<T> = UseBoundStore<StoreApi<T>> & { readonly use: Selectors<T> };

/**
 * Adds a selector hook per state key: `useLanguageStore.use.language()`. Call it once, at module
 * level, where the store is created.
 */
export function createSelectors<T extends object>(store: UseBoundStore<StoreApi<T>>): WithSelectors<T> {
  const use: Partial<Record<keyof T, () => unknown>> = {};
  for (const key of Object.keys(store.getState()) as (keyof T)[]) {
    use[key] = () => store(state => state[key]);
  }
  return Object.assign(store, { use: use as Selectors<T> });
}
