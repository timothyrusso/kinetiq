import { useCallback } from 'react';
import { useBootStore } from '@/features/bootstrap/state/bootStore';
import { runBootstrap } from '@/features/bootstrap/useCases/runBootstrap';
import { useEffectMutation } from '@/features/core/query';

/**
 * Runs the launch on the app runtime and follows it in the boot store. `start` launches once:
 * nothing while one is running or once one has finished. `retry` launches again after a failure;
 * past the deadline it goes back to waiting for the launch still running. `restart` launches again
 * whatever is running: after a reset, when the one running may be wedged on the data it erased.
 */
export function useBootstrap() {
  const { mutate } = useEffectMutation({
    mutationFn: (systemDark: boolean) => runBootstrap(systemDark),
    onSuccess: () => useBootStore.getState().ready(),
    onError: failure => useBootStore.getState().failed(failure),
  });
  const launch = useCallback(
    (systemDark: boolean) => {
      useBootStore.getState().starting();
      mutate(systemDark);
    },
    [mutate],
  );
  const start = useCallback(
    (systemDark: boolean) => {
      if (useBootStore.getState().phase === 'idle') launch(systemDark);
    },
    [launch],
  );
  const retry = useCallback(
    (systemDark: boolean) => {
      if (useBootStore.getState().phase === 'failed') launch(systemDark);
      else useBootStore.getState().starting();
    },
    [launch],
  );
  const markSlow = useCallback(() => useBootStore.getState().slow(), []);
  return {
    phase: useBootStore.use.phase(),
    failure: useBootStore.use.failure(),
    start,
    retry,
    restart: launch,
    markSlow,
  };
}
