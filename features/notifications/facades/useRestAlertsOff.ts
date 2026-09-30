import { useEffectMutation } from '@/features/core/query';
import { useNotificationPermission } from '@/features/notifications/facades/useNotificationPermission';
import { openNotificationSettings } from '@/features/notifications/useCases/readNotificationPermission';
import { useSettings } from '@/features/settings';

/**
 * Why a rest alert cannot be delivered: `permission`, the system refuses and will not ask again,
 * which only its settings can undo; `switch`, the app's own switch in Profile > Notifications.
 */
type RestAlertsOffReason = 'permission' | 'switch';

/**
 * Whether a rest's alert can reach the phone, and if not, why. `null` while the permission is
 * still being read or the system can still ask: the prompt is the answer then, not a warning.
 * A refusal outranks the switch, because the switch cannot be turned on without the permission.
 */
export function useRestAlertsOff() {
  const { granted, known, canAsk } = useNotificationPermission();
  const enabled = useSettings(settings => settings.notificationsEnabled);
  const { mutate: openSettings } = useEffectMutation({ mutationFn: () => openNotificationSettings });

  const reason: RestAlertsOffReason | null =
    known && !granted && !canAsk ? 'permission' : known && !enabled ? 'switch' : null;
  return { reason, openSystemSettings: openSettings };
}
