import { useCallback, useState } from 'react';
import { useResetLocalData } from '@/features/bootstrap/facades/useResetLocalData';
import { haptics } from '@/features/core/haptics';

/**
 * The slow launch's two ways out: try again, or a confirmed erase of the local data and a new
 * launch. The erase is best effort: if the database never opened there is nothing to clear, and
 * the new launch meets the same problem, which the fatal screen then names.
 */
export function useLaunchSurfaceLogic(onReset: () => void) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { mutate: reset, isError: resetFailed } = useResetLocalData();
  const askReset = useCallback(() => {
    haptics.warning();
    setConfirmingReset(true);
  }, []);
  const keepData = useCallback(() => setConfirmingReset(false), []);
  const confirmReset = useCallback(
    () =>
      reset(undefined, {
        onSettled: () => {
          setConfirmingReset(false);
          onReset();
        },
      }),
    [onReset, reset],
  );
  return { state: { confirmingReset, resetFailed }, effects: { askReset, keepData, confirmReset } };
}
