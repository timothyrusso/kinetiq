import { Linking } from 'react-native';
import { useConfirmedReset } from '@/features/bootstrap/facades/useConfirmedReset';
import { haptics } from '@/features/core/haptics';

/**
 * Storage-permission problems and a full disk both surface on the fatal screen, and both are fixed
 * outside the app.
 */
const openDeviceSettings = () => {
  // NOTE: bootstrap best effort, allow-listed: a device that cannot open its own settings leaves
  // the user on this screen with the other two ways out, and there is nothing further to report.
  void Linking.openSettings().catch(() => undefined);
};

/**
 * The fatal screen's ways out: try again, the device settings, and, when the launch failed on the
 * stored data (a migration or a read that raised `SqlError`), a confirmed erase of the local data
 * that runs the migrations again and launches again. Trying again alone cannot get past a failed
 * migration: the next launch meets the same data.
 */
export function useFatalScreenLogic(onReset: () => void) {
  const reset = useConfirmedReset(onReset, haptics.warning);
  return {
    state: { confirmingReset: reset.confirming, resetFailed: reset.failed },
    effects: { openDeviceSettings, askReset: reset.ask, keepData: reset.keep, confirmReset: reset.confirm },
  };
}
