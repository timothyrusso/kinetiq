import { router, usePathname } from 'expo-router';
import { useMemo } from 'react';
import type { ContentUnavailableAction } from '@/features/core/design-system';
import { TAB_LABELS, TAB_ROUTES, tabHref } from '@/features/core/navigation/nav';
import { useT } from '@/features/core/translations';

/**
 * An unmatched route: reachable through a deep link, a link that outlived a rename, or a stale
 * notification, each arriving with the user expecting something. So it is a way back, not a dead
 * end, and it names the path: the person most likely to see it can do something about it.
 */
export function useNotFoundPageLogic() {
  const { t } = useT();
  const pathname = usePathname();
  const canGoBack = router.canGoBack();

  const actions = useMemo<ContentUnavailableAction[]>(
    () => [
      // NOTE: `replace`, not `push`: a user who arrived by deep link should not be left with a
      // stack whose only other entry is this screen.
      { key: 'home', label: t('boot.goToHome'), prominent: true, onPress: () => router.replace(tabHref(0)) },
      // NOTE: only offered when there is somewhere to go: a back button that silently does nothing
      // reads as a second bug on top of the first.
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

  return {
    state: { detail: typeof pathname === 'string' && pathname.length > 0 ? pathname : null },
    derived: { actions, links },
  };
}
