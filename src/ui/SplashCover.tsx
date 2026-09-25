/**
 * Covers the handover from the native splash to the app, and fades out.
 *
 * ## The glitch this fixes
 *
 * The native splash can only follow the OS appearance. This app has its own light/dark/system
 * setting, so a user running the app in dark while the phone is in light gets the LIGHT splash
 * followed immediately by a near-black app: a full-screen cream-to-black cut on every launch.
 * Captured frame by frame, the app content appeared over the light splash background mid-hand
 * over, which is the worst possible version of it.
 *
 * The native splash's background cannot be changed at runtime, so the fix is not to change it
 * but to stop the change being a cut. This view mounts in the colour the native splash was
 * actually showing, which is decided by the OS appearance rather than by the app's theme, so the
 * first frame after the native splash hides is identical to the last frame before it. Then it
 * fades to transparent and the app's own background is revealed underneath.
 *
 * ## Why it renders the mark too
 *
 * Without it the logo would vanish the instant the native splash hid, before this view had
 * finished fading, so the mark would blink out and the background would fade after it. Drawing
 * the same asset at the same size means the cross fade has nothing moving in it.
 */
import { memo, useEffect } from 'react';
import { Image, StyleSheet, useColorScheme } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

/** Must match the `expo-splash-screen` plugin config in app.json. */
const NATIVE_SPLASH = {
  light: { background: '#FBFBF8', icon: require('../../assets/splash-icon-light.png') },
  dark: { background: '#000000', icon: require('../../assets/splash-icon.png') },
} as const;

const ICON_WIDTH = 180;

export const SplashCover = memo(function SplashCover({
  onFadeStart,
}: {
  /** Called once, when the cover begins fading: the moment to hide the native splash. */
  onFadeStart?: () => void;
}) {
  // `useColorScheme`, deliberately NOT the app's theme. This has to match what the OS drew.
  const osScheme = useColorScheme();
  const skin = osScheme === 'dark' ? NATIVE_SPLASH.dark : NATIVE_SPLASH.light;

  useEffect(() => {
    onFadeStart?.();
  }, [onFadeStart]);

  return (
    <Animated.View
      // `exiting` rather than a driven opacity: the view is unmounted by its parent when the app
      // is ready, and Reanimated owns the fade on the UI thread, so a busy JS thread during
      // hydration cannot stutter it.
      exiting={FadeOut.duration(260)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: skin.background }]}
    >
      <Image source={skin.icon} style={styles.icon} resizeMode="contain" />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  icon: { width: ICON_WIDTH, height: ICON_WIDTH },
});
