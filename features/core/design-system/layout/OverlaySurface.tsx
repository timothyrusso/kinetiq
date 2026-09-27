import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { Theme } from '@/features/core/theme';

/**
 * Frosted (iOS) or solid (Android) backing for anything that floats over scrolling
 * content: the tab bar, the workout footer.
 *
 * It has to be a **sibling** of the content rather than its parent, because a blur
 * surface that *contains* children re-blurs on every child update: which is exactly
 * the press feedback that needs to stay cheap. So a caller puts this first inside an
 * absolutely positioned container and lets its own children sit on top.
 *
 * The translucent `overlay` colour on its own is not enough: 86% alpha over a light
 * list still shows the rows underneath as ghosts, which on the workout screen read as
 * set rows duplicated behind the Finish button. The blur is what makes it a surface.
 */
export const OverlaySurface = memo(function OverlaySurface({
  theme,
  edge = 'top',
}: {
  theme: Theme;
  /** Which edge the hairline goes on: the side that meets the content. */
  edge?: 'top' | 'bottom';
}) {
  // NOTE: Written as a conditional rather than a computed key: an object with a computed
  // key widens to an index signature, which no longer type-checks against `ViewStyle`.
  const hairline = (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(edge === 'top' ? { top: 0 } : { bottom: 0 }),
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.overlayBorder,
      }}
    />
  );
  // NOTE: Liquid Glass, where the OS has it (iOS 26+). This is the real system material: it
  // refracts and specularly highlights the content scrolling under it, which a blur cannot
  // do: so it gets NO opaque base: an opaque layer underneath would be the one thing that
  // defeats it. No hairline either; the material carries its own edge, and Apple's own glass
  // bars do not draw one.
  //
  // `colorScheme` is passed explicitly rather than left on `auto` because this app has its
  // own light/dark/system setting: on `auto` the glass follows the OS while the app follows
  // the user, and the bar ends up light under a dark app.
  if (liquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={theme.mode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  const base = (
    // NOTE: An opaque base first, so the bar is never transparent to the content behind it
    // even if the material fails to initialise.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} />
  );
  if (Platform.OS !== 'ios') {
    return (
      <>
        {base}
        {hairline}
      </>
    );
  }
  return (
    <>
      {base}
      <BlurView
        // NOTE: The material the real iOS bar uses, so this matches the nav bar above it.
        tint={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={theme.mode === 'dark' ? 68 : 80}
        style={StyleSheet.absoluteFill}
      />
      {hairline}
    </>
  );
});

/**
 * Is Liquid Glass available on this device?
 *
 * Resolved once, lazily: not at module scope. This module is imported by the tab bar, which
 * is on the first frame, and asking a native module a question before it has registered
 * answers wrong rather than throwing. Cached because the answer cannot change at runtime.
 */
let liquidGlassCache: boolean | null = null;
function liquidGlass(): boolean {
  if (liquidGlassCache === null) {
    try {
      liquidGlassCache = isLiquidGlassAvailable();
    } catch {
      liquidGlassCache = false;
    }
  }
  return liquidGlassCache;
}
