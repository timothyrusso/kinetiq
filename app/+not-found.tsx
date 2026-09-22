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
 * nothing. It is `faint` and small so a real user is not read a filename by VoiceOver before
 * they are offered a way out: the buttons come first in the tree for that reason.
 */
import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/ui/Screen';
import { Stack as Column } from '@/ui/layout';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Text';
import { spacing } from '@/theme/tokens';
import { TAB_ROUTES, TAB_LABELS, tabHref } from '@/navigation/nav';
import { useT } from '@/i18n/useT';

export default function NotFoundScreen() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <Screen>
      {/* `flex: 1` above and below rather than `justifyContent: 'center'`: centring clips the
          block on a small phone in landscape, and a not-found screen that cannot be scrolled
          to read is a second failure stacked on the first. */}
      <View style={{ flex: 1 }} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}>
        <Txt variant="micro" tone="faint" align="center" uppercase tracking={1.4}>
          {t('boot.notFound')}
        </Txt>
        <Txt variant="title" weight="700" align="center" style={{ marginTop: spacing.sm }}>
          {t('boot.noScreenHere')}
        </Txt>
        <Txt variant="body" tone="muted" align="center" style={{ marginTop: spacing.md }}>
          {t('misc.notFoundBody')}
        </Txt>
        {typeof pathname === 'string' && pathname.length > 0 ? (
          <Txt variant="monoSm" tone="faint" align="center" style={{ marginTop: spacing.md }}>
            {pathname}
          </Txt>
        ) : null}

        <Column gap="sm" style={{ width: '100%', marginTop: spacing.xxl }}>
          {/* `replace`, not `push`: a user who arrived by deep link should not be left with a
              stack whose only other entry is this screen. */}
          <Button
            label={t('boot.goToHome')}
            variant="primary"
            fullWidth
            icon="home"
            onPress={() => router.replace(tabHref(0))}
          />
          {/* Only offered when there is somewhere to go: a back button that silently no-ops
              reads as a second bug on top of the first. */}
          {router.canGoBack() ? (
            <Button label={t('common.back')} variant="secondary" fullWidth onPress={() => router.back()} />
          ) : null}
        </Column>

        <View style={styles.tabs}>
          {TAB_ROUTES.map((key, index) => (
            <Txt
              key={key}
              variant="label"
              tone="accent"
              align="center"
              style={styles.tabLink}
              onPress={() => router.replace(tabHref(index))}
              accessibilityRole="link"
            >
              {t(TAB_LABELS[key])}
            </Txt>
          ))}
        </View>
      </View>
      <View style={{ flex: 2 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xxxl,
  },
  tabLink: { paddingVertical: spacing.sm, minWidth: 56 },
});
