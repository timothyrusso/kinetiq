import { ContentUnavailable, ScreenHeader } from '@/features/core/design-system';
import { useNotFoundPageLogic } from '@/features/core/navigation/ui/pages/NotFoundPage/NotFoundPage.logic';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

/**
 * The unmatched route. `ContentUnavailable` is SwiftUI's own `ContentUnavailableView` on iOS and
 * the Material empty state on Android; the header is the navigator's, titled so the bar never
 * shows the route's file name.
 */
export function NotFoundPage() {
  const { state, derived } = useNotFoundPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  return (
    <>
      <ScreenHeader title={t('boot.notFound')} largeTitle={false} />
      <ContentUnavailable
        theme={theme}
        title={t('boot.noScreenHere')}
        description={t('misc.notFoundBody')}
        systemImage="questionmark.folder"
        icon="info"
        {...(state.detail !== null ? { detail: state.detail } : {})}
        actions={derived.actions}
        links={derived.links}
        linksLabel={t('systemScreens.openTab')}
      />
    </>
  );
}
