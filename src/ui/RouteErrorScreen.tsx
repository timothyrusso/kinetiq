/**
 * Route-level error screen.
 *
 * Used by expo-router's per-route `ErrorBoundary` export and by the root class
 * boundary. Both exist because React's rule is that an error with no boundary above it
 * unmounts the entire tree: a blank app with no message, which is the single worst
 * failure a user can be left with.
 *
 * ## Native, and deliberately not `Txt`
 *
 * `ContentUnavailable` is SwiftUI's `ContentUnavailableView` on iOS and the Material
 * empty-state layout on Android, and it takes its colours as a prop. That matters here: the
 * themed primitives reach for `useAppTheme()`, which reads the settings store, which reads a
 * database. If the failure *is* the store or the theme, a themed error screen throws while
 * reporting the throw: and a boundary's boundary is a crash, not an error screen.
 *
 * The `theme` prop rather than a hook for the same reason: the caller decides how
 * confident it is that the theme is resolvable (the router boundary knows the app
 * mounted fine; the root boundary does not, and passes a fixed dark theme).
 */
import type { Theme } from '@/theme/theme';
import { ContentUnavailable, type ContentUnavailableAction } from '@/ui/controls/ContentUnavailable';
import { useT } from '@/i18n/useT';

export function RouteErrorScreen({
  error,
  theme,
  onRetry,
  onGoHome,
}: {
  error: Error;
  theme: Theme;
  onRetry: () => void;
  onGoHome?: () => void;
}) {
  const { t } = useT();
  // The first frames are usually inside a library, and the line the user needs is the third or
  // fourth, so the trace is kept but cut to a length that survives a support screenshot. The
  // message is shown on its own above it and selectable, because the job of this screen is to
  // get the message out of the app and into a bug report.
  const trace = error.stack ? error.stack.split('\n').slice(0, 8).join('\n') : undefined;
  const actions: ContentUnavailableAction[] = [
    { key: 'retry', label: t('boot.tryAgain'), prominent: true, onPress: onRetry },
    ...(onGoHome ? [{ key: 'home', label: t('boot.goToHome'), onPress: onGoHome }] : []),
  ];

  return (
    <ContentUnavailable
      theme={theme}
      tone="danger"
      title={t('boot.screenError')}
      description={t('misc.routeErrorBody')}
      systemImage="exclamationmark.triangle"
      icon="warning"
      detail={error.message || t('systemScreens.unknownError')}
      {...(trace ? { trace } : {})}
      actions={actions}
    />
  );
}
