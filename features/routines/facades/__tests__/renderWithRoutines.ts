import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import { createElement, type ReactNode } from 'react';
import { makeTestRuntime } from '@/features/core/testing';
import { RoutinesTestLayer } from '@/features/routines/di/__tests__/routinesTestLayer';

const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/**
 * Renders `hook` over a test runtime with the real routines and exercises Layers on a migrated
 * in-memory database. `runtime` seeds data through a use case; `done` disposes it, at the end of
 * the test.
 */
export const renderWithRoutines = async <Props, Result>(
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
) => {
  const { runtime, logs } = makeTestRuntime(RoutinesTestLayer);
  // NOTE: the runtime provides the routines, the exercises and the core test services, not every
  // app service the provider's type names; these hooks need nothing else, and a missing one would
  // fail the test as a defect.
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
  return { ...rendered, logs, runtime, done: () => runtime.dispose() };
};
