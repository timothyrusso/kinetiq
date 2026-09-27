import { NavigationContext, NavigationRouteContext, PreventRemoveContext } from 'expo-router/react-navigation';
import { createElement } from 'react';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { anExerciseSnapshot, anotherRoutineItem, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutinesTestLayer } from '@/features/routines/di/__tests__/routinesTestLayer';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { createRoutine, type NewRoutine } from '@/features/routines/useCases/createRoutine';
import { getRoutineDetail } from '@/features/routines/useCases/getRoutineDetail';
import { listRoutines } from '@/features/routines/useCases/listRoutines';

/** A push day with the bench press and the overhead press, and both snapshots. */
export const aPushDay = (overrides: Partial<NewRoutine> = {}): NewRoutine => ({
  name: 'Push Day',
  items: [aRoutineItem(), anotherRoutineItem()],
  snapshots: [
    anExerciseSnapshot(),
    anExerciseSnapshot({ exerciseId: 'wger:74', name: 'Overhead Press', externalId: 74 }),
  ],
  ...overrides,
});

/** What a `beforeRemove` listener receives: the navigation the user started, and a way to stop it. */
interface BeforeRemove {
  readonly data: { readonly action: { readonly type: string } };
  readonly preventDefault: () => void;
}

/**
 * The screen the page is mounted in, as the navigator hands it to `usePreventRemove`: `leave`
 * starts a navigation away and answers whether a leave guard stopped it.
 */
const makeScreen = () => {
  const listeners = new Set<(event: BeforeRemove) => void>();
  const navigation = {
    addListener: (_type: string, listener: (event: BeforeRemove) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  const leave = (type = 'GO_BACK') => {
    let prevented = false;
    for (const listener of listeners)
      listener({ data: { action: { type } }, preventDefault: () => (prevented = true) });
    return prevented;
  };
  return { navigation, leave };
};

/**
 * Renders a routine page's ViewModel over the real routines on a migrated in-memory database,
 * inside the screen's navigation, which `usePreventRemove` reads; `done` disposes the runtime.
 */
export const renderRoutinesPage = async <Props, Result>(
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
) => {
  const screen = makeScreen();
  const preventRemove = { setPreventRemove: () => undefined };
  const route = { key: 'screen-1', name: 'screen' };
  const rendered = await renderWithLayer(RoutinesTestLayer, hook, initialProps, children =>
    createElement(
      NavigationContext.Provider,
      { value: screen.navigation as never },
      createElement(
        NavigationRouteContext.Provider,
        { value: route },
        createElement(PreventRemoveContext.Provider, { value: preventRemove as never }, children),
      ),
    ),
  );
  return { ...rendered, leave: screen.leave, list: () => rendered.runtime.runPromise(listRoutines) };
};

/**
 * {@link renderRoutinesPage} after saving `routine` and routing to it with `params` (the saved id
 * is added as `id`). `read` reads it back through the use case.
 */
export const renderOnRoutine = async <Props, Result>(
  hook: (props: Props) => Result,
  initialProps: NoInfer<Props>,
  {
    routine = aPushDay(),
    params = {},
  }: { readonly routine?: NewRoutine; readonly params?: Record<string, string> } = {},
) => {
  const rendered = await renderRoutinesPage(hook, initialProps);
  const saved = await rendered.runtime.runPromise(createRoutine(routine));
  routerFake.setParams({ id: saved.id, ...params });
  await rendered.rerender(initialProps);
  return {
    ...rendered,
    id: saved.id,
    save: (next: NewRoutine) => rendered.runtime.runPromise(createRoutine(next)),
    read: (id: RoutineId = saved.id) => rendered.runtime.runPromise(getRoutineDetail(id)),
  };
};
