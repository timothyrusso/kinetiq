import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import { createElement, type ReactNode } from 'react';
import { makeTestRuntime } from '@/features/core/testing';
import { makeCatalogRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

/**
 * The query clients the hooks ran on. They are made here rather than by `makeTestWrapper` so they
 * can be cleared once every hook has unmounted: the catalog facades' own `gcTime` would otherwise
 * leave a ten-minute timer behind each test and keep jest from exiting.
 */
const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/**
 * Renders `hook` over a test runtime whose catalog is a `makeCatalogRepositoryFake(options)`.
 * `done` disposes the runtime; call it at the end of the test.
 */
export const renderWithCatalog = async <Props, Result>(
  hook: (props: Props) => Result,
  options: Parameters<typeof makeCatalogRepositoryFake>[0],
  initialProps: Props,
) => {
  const { runtime, logs } = makeTestRuntime(makeCatalogRepositoryFake(options));
  // NOTE: the runtime provides the catalog and the core test services, not every app service the
  // provider's type names; the catalog facades need nothing else, and a missing one would fail the
  // test as a defect.
  const provided = runtime as unknown as ProvidedRuntime;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(EffectRuntimeProvider, { runtime: provided }, children),
    );
  const rendered = await renderHook(hook, { wrapper, initialProps });
  return { ...rendered, logs, done: () => runtime.dispose() };
};
