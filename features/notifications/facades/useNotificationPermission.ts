import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useEffectMutation, useEffectQuery } from '@/features/core/query';
import {
  readNotificationPermission,
  requestNotificationPermission,
} from '@/features/notifications/useCases/readNotificationPermission';
import { getSettings, updateSettings } from '@/features/settings';

const PERMISSION_KEY = ['notifications', 'permission'] as const;

/**
 * The notification permission as a live read, re-read whenever the app comes back to the
 * foreground: the user can revoke it in System Settings without anything happening in the app.
 *
 * The answer is also written back into the settings store (`notificationsGranted`), which the
 * workout session reads synchronously to decide whether to arm a rest alert: boot reads it once,
 * so a permission granted later would otherwise never reach it. Only when it moved, because a
 * settings write notifies every subscriber.
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
    if (granted !== undefined && granted !== getSettings().notificationsGranted) {
      updateSettings({ notificationsGranted: granted });
    }
  }, [granted]);

  return {
    granted: granted ?? false,
    // NOTE: a system prompt is on screen: a button disables itself instead of asking twice.
    requesting: request.isPending,
    request: request.mutate,
  };
}
