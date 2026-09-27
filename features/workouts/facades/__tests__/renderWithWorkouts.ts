import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import { createElement, type ReactNode } from 'react';
import { makeTestRuntime } from '@/features/core/testing';
import { WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';

const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/**
 * Renders `hook` over a test runtime with the real workouts and exercises Layers on a migrated
 * in-memory database. `done` disposes the runtime, at the end of the test.
 */
export const renderWithWorkouts = async <Props, Result>(
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
) => {
  const { runtime, logs } = makeTestRuntime(WorkoutsTestLayer);
  // NOTE: the runtime provides the workouts, the exercises and the core test services, not every
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
