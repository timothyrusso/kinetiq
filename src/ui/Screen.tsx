
import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme';

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
