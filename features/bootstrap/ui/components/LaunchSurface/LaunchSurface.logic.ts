import { useConfirmedReset } from '@/features/bootstrap/facades/useConfirmedReset';
import { haptics } from '@/features/core/haptics';

/** The slow launch's two ways out: try again, or a confirmed erase of the local data and a new launch. */
export function useLaunchSurfaceLogic(onReset: () => void) {
  const reset = useConfirmedReset(onReset, haptics.warning);
  return {
    state: { confirmingReset: reset.confirming, resetFailed: reset.failed },
    effects: { askReset: reset.ask, keepData: reset.keep, confirmReset: reset.confirm },
  };
}
