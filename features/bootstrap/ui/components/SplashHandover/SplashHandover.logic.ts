import { useEffect, useState } from 'react';
import { splash } from '@/features/bootstrap/ui/components/AppProviders/splash';
import { useAppTheme } from '@/features/core/theme';

/** How long the cover is held before the native splash goes beneath it: one beat, so it has painted. */
const COVER_HOLD_MS = 120;

/**
 * Hands the native splash over to the app once the ready tree is on screen. The native splash
 * follows the OS appearance, the app has its own theme. When the two agree the splash simply
 * hides, one frame after the ready tree is presented; when they disagree, the cover mounts in the
 * splash's colour and fades out over the app, rather than cutting from cream to black. Decided
 * once, at launch: a theme change later is not a handover.
 */
export function useSplashHandoverLogic(systemDark: boolean) {
  const appDark = useAppTheme().mode === 'dark';
  const [mismatch] = useState(appDark !== systemDark);
  const [covering, setCovering] = useState(mismatch);

  useEffect(() => {
    if (mismatch) {
      const id = setTimeout(() => setCovering(false), COVER_HOLD_MS);
      return () => clearTimeout(id);
    }
    const frame = requestAnimationFrame(() => splash.hide());
    return () => cancelAnimationFrame(frame);
  }, [mismatch]);

  return { state: { covering }, effects: { hideSplash: splash.hide } };
}
