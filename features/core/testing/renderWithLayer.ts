import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import type { Layer } from 'effect';
import { createElement, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type CoreTestServices, makeTestRuntime } from '@/features/core/testing/testAppLayer';

/**
 * The query clients the hooks ran on, cleared once every test of the file has finished: a
 * facade's own `gcTime` would otherwise leave a timer behind each test and keep jest from exiting.
 */
const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/** A phone's safe area, which the pages' bottom padding is measured from: an iPhone 17 Pro. */
const SAFE_AREA = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders `hook` (a facade or a ViewModel) over a test runtime of `features` on the core test
 * services, inside the providers the app mounts. `runtime` seeds data through a use case, `logs`
 * and `haptics` are what the boundary logged and played, and `done` unmounts the hook and disposes
 * the runtime: call it at the end of the test. `around` wraps the hook in what else its screen is
 * mounted in (a navigator's contexts), inside the safe area and outside the app's providers.
 */
export const renderWithLayer = async <Props, Result, R, E>(
  features: Layer.Layer<R, E, CoreTestServices>,
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
  around: (children: ReactNode) => ReactNode = children => children,
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
      SafeAreaProvider,
      { initialMetrics: SAFE_AREA },
      around(
        createElement(
          QueryClientProvider,
          { client },
          createElement(EffectRuntimeProvider, { runtime: provided }, children),
        ),
      ),
    );
  const rendered = await renderHook(hook, { wrapper, initialProps });
  const done = async () => {
    await rendered.unmount();
    await runtime.dispose();
  };
  return { ...rendered, logs, haptics, runtime, client, done };
};
