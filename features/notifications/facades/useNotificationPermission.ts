import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useEffectMutation, useEffectQuery } from '@/features/core/query';
import {
  askNotificationPermissionOnce,
  readNotificationPermission,
  requestNotificationPermission,
} from '@/features/notifications/useCases/readNotificationPermission';
import { getSettings, updateSettings, useSettings } from '@/features/settings';

const PERMISSION_KEY = ['notifications', 'permission'] as const;

/** Writes `granted` into the settings store, only when it moved: a settings write notifies every subscriber. */
function mirrorGranted(granted: boolean) {
  if (granted !== getSettings().notificationsGranted) updateSettings({ notificationsGranted: granted });
}

/**
 * The notification permission as a live read, re-read whenever the app comes back to the
 * foreground: the user can revoke it in System Settings without anything happening in the app.
 *
 * The answer is also written back into the settings store (`notificationsGranted`), which the
 * workout session reads synchronously to decide whether to arm a rest alert: boot reads it once,
 * so a permission granted later would otherwise never reach it.
 *
 * `known` is false until the device has answered, so a caller does not report a refusal that is
 * only a read still in flight; `canAsk` says the system would still show its prompt.
 */
export function useNotificationPermission() {
  const queryClient = useQueryClient();
  const permission = useEffectQuery({
    queryKey: PERMISSION_KEY,
    queryFn: readNotificationPermission,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });
  const request = useEffectMutation({
    mutationFn: () => requestNotificationPermission,
    onSuccess: answer => queryClient.setQueryData(PERMISSION_KEY, answer),
  });

  const granted = permission.data?.granted ?? (permission.isError ? false : undefined);
  useEffect(() => {
    if (granted !== undefined) mirrorGranted(granted);
  }, [granted]);

  return {
    granted: granted ?? false,
    known: granted !== undefined,
    canAsk: permission.data?.canAsk ?? false,
    // NOTE: a system prompt is on screen: a button disables itself instead of asking twice.
    requesting: request.isPending,
    request: request.mutate,
  };
}

/**
 * Asks for the permission the first time `when` holds, and only while the system can still show
 * its prompt and the app's own switch is on: a workout start is when a rest alert is about to be
 * needed, and a user who switched alerts off in the app has already answered. The answer lands
 * in the settings store at once, so a rest already running arms its alert without a relaunch.
 *
 * Once the prompt has been shown, `notificationsAsked` is stored and no later start asks again,
 * across relaunches: Android 13+ would show it a second time after a refusal.
 */
export function useAskNotificationPermissionOnce(when: boolean) {
  const queryClient = useQueryClient();
  const enabled = useSettings(settings => settings.notificationsEnabled);
  const alreadyAsked = useSettings(settings => settings.notificationsAsked);
  const checked = useRef(false);
  const { mutate } = useEffectMutation({
    mutationFn: () => askNotificationPermissionOnce,
    onSuccess: ({ permission, requested }) => {
      queryClient.setQueryData(PERMISSION_KEY, permission);
      mirrorGranted(permission.granted);
      if (requested) updateSettings({ notificationsAsked: true });
    },
  });
  useEffect(() => {
    if (!when || !enabled || alreadyAsked || checked.current) return;
    checked.current = true;
    mutate();
  }, [alreadyAsked, enabled, mutate, when]);
}
