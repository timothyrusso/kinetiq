/**
 * Unmatched route.
 *
 * ## When this is reachable
 *
 * Not through the app's own chrome: every internal link goes through `routes` in
 * `src/navigation/nav.ts`, and a mistyped path there stops being invisible the moment the
 * generated route types exist. It is reachable through a deep link (`kinetiq://progresss`),
 * through a link that outlived a rename, and through a stale notification after a reminder's
 * destination moved. All three arrive with the app already open and the user expecting
 * *something*, so this screen is a way back rather than a dead end.
 *
 * ## Why it names the path
 *
 * Because the person most likely to see this screen is the person who can do something about
 * it. "No screen at `/settings/units2`" identifies the mistake; "Page not found" identifies
 * nothing. It is small and secondary, under the explanation, so it reads as a detail and not
 * as the headline.
 *
 * ## Native on both platforms
 *
 * `ContentUnavailable` is SwiftUI's own `ContentUnavailableView` on iOS and the Material
 * empty-state layout on Android. The header is the navigator's, titled so the bar never shows
 * the route's file name.
 */
import { useMemo } from 'react';
import { router, usePathname } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { ContentUnavailable, type ContentUnavailableAction } from '@/ui/controls/ContentUnavailable';
import { useAppTheme } from '@/theme/theme';
import { TAB_ROUTES, TAB_LABELS, tabHref } from '@/navigation/nav';
import { useT } from '@/i18n/useT';

export default function NotFoundScreen() {
  const { t } = useT();
  const theme = useAppTheme();
  const pathname = usePathname();
  const canGoBack = router.canGoBack();

  const actions = useMemo<ContentUnavailableAction[]>(
    () => [
      // `replace`, not `push`: a user who arrived by deep link should not be left with a stack
      // whose only other entry is this screen.
      { key: 'home', label: t('boot.goToHome'), prominent: true, onPress: () => router.replace(tabHref(0)) },
      // Only offered when there is somewhere to go: a back button that silently no-ops reads as
      // a second bug on top of the first.
      ...(canGoBack ? [{ key: 'back', label: t('common.back'), onPress: () => router.back() }] : []),
    ],
    [canGoBack, t],
  );

  const links = useMemo(
    () =>
      TAB_ROUTES.map((key, index) => ({
        key,
        label: t(TAB_LABELS[key]),
        onPress: () => router.replace(tabHref(index)),
      })),
    [t],
  );

  return (
    <>
      <ScreenHeader title={t('boot.notFound')} largeTitle={false} />
      <ContentUnavailable
        theme={theme}
        title={t('boot.noScreenHere')}
        description={t('misc.notFoundBody')}
        systemImage="questionmark.folder"
        icon="info"
        {...(typeof pathname === 'string' && pathname.length > 0 ? { detail: pathname } : {})}
        actions={actions}
        links={links}
        linksLabel={t('systemScreens.openTab')}
      />
    </>
  );
}
