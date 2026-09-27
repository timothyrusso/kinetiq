import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import type { Layer } from 'effect';
import { createElement, type ReactNode } from 'react';
import { type CoreTestServices, makeTestRuntime } from '@/features/core/testing/testAppLayer';

/**
 * The query clients the hooks ran on, cleared once every test of the file has finished: a
 * facade's own `gcTime` would otherwise leave a timer behind each test and keep jest from exiting.
 */
const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/**
 * Renders `hook` (a facade or a ViewModel) over a test runtime of `features` on the core test
 * services, inside the providers the app mounts. `runtime` seeds data through a use case, `logs`
 * and `haptics` are what the boundary logged and played, and `done` disposes the runtime: call it
 * at the end of the test.
 */
export const renderWithLayer = async <Props, Result, R, E>(
  features: Layer.Layer<R, E, CoreTestServices>,
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
) => {
  const { runtime, logs, haptics } = makeTestRuntime(features);
  // NOTE: the runtime provides `features` and the core test services, not every app service the
  // provider's type names (`makeTestWrapper` asks for all of them); a hook that needs a service the
  // test left out fails as a defect, which is the test telling you what to add.
  const provided = runtime as unknown as ProvidedRuntime;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(EffectRuntimeProvider, { runtime: provided }, children),
    );
  const rendered = await renderHook(hook, { wrapper, initialProps });
  return { ...rendered, logs, haptics, runtime, client, done: () => runtime.dispose() };
};
