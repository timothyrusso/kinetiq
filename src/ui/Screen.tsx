/**
 * Screen scaffold: per-screen header options for the platform's own bar, and the containers
 * that sit under it.
 *
 * ## The header is the navigator's, not ours
 *
 * Every stack draws the native header with the shared look from `src/navigation/headerOptions`.
 * A screen only says what is specific to it: its title, whether the title is large, whether the
 * bar floats over media. There is no custom bar, no custom back button and no custom title view
 * left in the app: those existed because the header used to be hidden and redrawn, and each
 * redrawing (two of them, with different vertical-centring maths) was a way for the app to feel
 * slightly unlike the platform it runs on.
 *
 * ## One line of title
 *
 * The native title holds one line. What used to be a subtitle under it is now the first line of
 * the screen's content, as a `MetaLine`.
 *
 * ## Scroll views and the large title
 *
 * A large title collapses by coupling to the scroll view's content inset, and the native stack
 * finds that scroll view only when it is the screen's own first child. So `ScreenScroll` and
 * lists spread with `SCROLL_INSETS` are rendered directly, never wrapped in a filling `View`:
 * wrapped, the title renders but never shrinks.
 */
import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme';
import { screenGutter } from '@/theme/tokens';
import { useScreenContentBottom, useTabContentBottom } from '@/ui/insets';

/**
 * Opaque screen background, edge to edge, for a screen whose content does not scroll.
 *
 * A screen with no container of its own would let the previous screen show through during a
 * push, because the navigator's content colour is only painted once the transition settles.
 */
export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>{children}</View>
  );
}

/**
 * This screen's header options. Renders nothing itself.
 *
 * `largeTitle` for hubs and lists; the tab stacks already default to it. `transparent` for the
 * two media screens, where the bar floats over an image or a map and the system blurs what
 * scrolls under it.
 */
export function ScreenHeader({
  title,
  largeTitle,
  transparent = false,
  shown = true,
}: {
  title: string;
  largeTitle?: boolean;
  transparent?: boolean;
  /** `false` only for the immersive screens: the live workout and a running recording. */
  shown?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: shown,
        ...(largeTitle === undefined ? {} : { headerLargeTitle: largeTitle }),
        ...(transparent
          ? {
              headerTransparent: true,
              headerLargeTitle: false,
              headerBlurEffect:
                theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
              headerStyle: { backgroundColor: 'transparent' },
            }
          : {}),
      }}
    />
  );
}

/**
 * The props every screen-level list spreads, so iOS owns the insets under the header and the
 * tab bar and can collapse a large title as the list scrolls.
 */
export const SCROLL_INSETS = { contentInsetAdjustmentBehavior: 'automatic' } as const;

/**
 * A screen's scroll view: automatic insets, the screen gutter, and bottom room that clears
 * whatever sits below the content (the home indicator, or the tab bar and its accessory).
 */
export function ScreenScroll({
  children,
  contentContainerStyle,
  gutter = true,
  inTab = false,
  ...rest
}: ScrollViewProps & {
  children: ReactNode;
  /** Off for full-bleed content (a hero image) that places its own gutter per section. */
  gutter?: boolean;
  /** On a tab's root screen, clear the tab bar rather than the home indicator. */
  inTab?: boolean;
}) {
  const theme = useAppTheme();
  const screenBottom = useScreenContentBottom();
  const tabBottom = useTabContentBottom();
  return (
    <ScrollView
      {...SCROLL_INSETS}
      keyboardShouldPersistTaps="handled"
      {...rest}
      style={[{ backgroundColor: theme.colors.background }, rest.style]}
      contentContainerStyle={[
        gutter ? styles.gutter : null,
        { paddingBottom: inTab ? tabBottom : screenBottom },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gutter: { paddingHorizontal: screenGutter },
});
