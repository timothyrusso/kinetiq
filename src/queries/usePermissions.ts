/**
 * Permission state as a live read.
 *
 * ## Why this is a hook over a service call and not a TanStack Query
 *
 * "Put it in Query" is the reflex answer for anything asynchronous, and here it would be
 * wrong in a way worth naming. Query's value is caching a *fetch*: keys, staleness,
 * retries, deduplication. A permission is not fetched content: one cheap native call, no
 * pagination or retry story worth modelling, and nothing useful to serve from a stale copy.
 * The interesting half of the problem is not the read, it is *invalidation*: the user can
 * revoke location or notifications by opening System Settings, changing a toggle, and coming
 * back, and nothing inside this app happened in between. So this module is the read plus the
 * re-read-on-focus trigger: which is the exact thing a cache would have had to grow anyway.
 *
 * ## The re-read trigger
 *
 * `focusManager` is TanStack Query's own focus primitive, already wired to AppState by the
 * default setup in `query/client.ts`. Subscribing to it rather than to `AppState` directly
 * means one app-state listener in the tree instead of one per subscriber, and it keeps
 * permission refresh on exactly the same notion of "the user came back" that the network
 * queries already refresh on: so a screen's permissions and its data are never of two
 * different eras.
 *
 * ## Why one hook returns everything
 *
 * Splitting read and request into separate hooks would need a channel between them for the
 * request's answer to reach the read on screen. One hook with one state object is the same
 * guarantee with no channel, and a screen that asks for permissions gets the truth and the
 * two ways to ask for more.
 *
 * ## Writing the notification answer back into settings
 *
 * `notificationsGranted` lives in the settings store: seeded at boot in `bootstrap.tsx`, * and the workout session reads it synchronously to decide whether to arm a rest-timer
 * alert. That is the right home for it (device truth that render code reads, not a query
 * result), but boot runs once, so a permission granted *after* boot would never reach it:
 * someone who tapped "Don't allow" and later enabled notifications in System Settings would
 * find the timer still silent with no way to explain why. So the hook that reads the truth
 * also writes it back. One writer, one direction: device → store. The user's *preference*
 * (`notificationsEnabled`) is untouched: a different flag, and the session requires both.
 */
import { useCallback, useEffect, useState } from 'react';
import { focusManager } from '@tanstack/react-query';

import {
  readNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/services/notifications';
import { recorder, type LocationPermissionStatus } from '@/services/location';
import { getSettings, updateSettings } from '@/settings';

export type Permissions = {
  location: LocationPermissionStatus;
  notifications: NotificationPermission;
  /** Until the first read lands, so a screen shows a skeleton rather than a false "Denied". */
  loading: boolean;
  /** A system prompt is on screen. Lets a button disable itself instead of asking twice. */
  requesting: 'location' | 'notifications' | null;
  requestLocation: () => Promise<LocationPermissionStatus>;
  requestNotifications: () => Promise<NotificationPermission>;
  /** Re-read without a prompt: the pull gesture on the permissions screen. */
  refresh: () => Promise<void>;
};

async function readAll(): Promise<Pick<Permissions, 'location' | 'notifications'>> {
  // In parallel: independent native calls, and sequencing them would put the second one's
  // latency in front of the screen for no reason.
  const [location, notifications] = await Promise.all([
    recorder.ensurePermission(),
    readNotificationPermission(),
  ]);
  return { location, notifications };
}

export function usePermissions(): Permissions {
  const [location, setLocation] = useState<LocationPermissionStatus>('undetermined');
  const [notifications, setNotifications] = useState<NotificationPermission>({
    granted: false,
    ios: false,
  });
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<Permissions['requesting']>(null);

  const refresh = useCallback(async () => {
    const next = await readAll();
    setLocation(next.location);
    setNotifications(next.notifications);
    setLoading(false);
    // Only written when it actually moved, because `updateSettings` notifies every settings
    // subscriber: writing an unchanged boolean on every app focus would re-render the whole
    // tree for nothing. `getSettings()` is read here rather than captured so the comparison
    // is always against the current value.
    if (next.notifications.granted !== getSettings().notificationsGranted) {
      updateSettings({ notificationsGranted: next.notifications.granted });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // The user can revoke either permission outside the app entirely; focus is the only
    // signal that they might have.
    return focusManager.subscribe(() => void refresh());
  }, [refresh]);

  const requestLocation = useCallback(async () => {
    // Re-entrant taps on "Enable location" must not stack prompts. The recorder serialises
    // internally, but the second call would still resolve with a stale-looking status.
    if (requesting === 'location') return recorder.getPermission();
    setRequesting('location');
    try {
      const status = await recorder.requestPermission();
      setLocation(status);
      return status;
    } finally {
      setRequesting(null);
    }
  }, [requesting]);

  const requestNotifications = useCallback(async () => {
    if (requesting === 'notifications') return { granted: false, ios: false };
    setRequesting('notifications');
    try {
      const result = await requestNotificationPermission();
      setNotifications(result);
      // Not optional: this flag is what gates arming a rest-timer alert, so a grant that
      // lived only in this component's state would leave the timer quiet for the rest of
      // the app's life.
      updateSettings({ notificationsGranted: result.granted });
      return result;
    } finally {
      setRequesting(null);
    }
  }, [requesting]);

  return {
    location,
    notifications,
    loading,
    requesting,
    requestLocation,
    requestNotifications,
    refresh,
  };
}
