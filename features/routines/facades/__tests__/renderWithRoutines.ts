import { renderWithLayer } from '@/features/core/testing';
import { RoutinesTestLayer } from '@/features/routines/di/__tests__/routinesTestLayer';

/**
 * Renders `hook` over a test runtime with the real routines and exercises Layers on a migrated
 * in-memory database. `runtime` seeds data through a use case; `done` disposes it, at the end of
 * the test.
 */
export const renderWithRoutines = <Props, Result>(hook: (props: Props) => Result, initialProps: NoInfer<Props>) =>
  renderWithLayer(RoutinesTestLayer, hook, initialProps);
