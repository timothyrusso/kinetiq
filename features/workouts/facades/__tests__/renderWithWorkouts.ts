import { renderWithLayer } from '@/features/core/testing';
import { WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';

/**
 * Renders `hook` over a test runtime with the real workouts and exercises Layers on a migrated
 * in-memory database. `done` disposes the runtime, at the end of the test.
 */
export const renderWithWorkouts = <Props, Result>(hook: (props: Props) => Result, initialProps: NoInfer<Props>) =>
  renderWithLayer(WorkoutsTestLayer, hook, initialProps);
