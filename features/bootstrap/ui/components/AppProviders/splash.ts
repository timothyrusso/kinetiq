import * as SplashScreen from 'expo-splash-screen';

/**
 * The native splash, held until the first frame worth drawing. Unawaited on purpose: awaiting at
 * module scope would put a rejection in front of React's own error handling, and a device with no
 * native splash to hold simply carries on. The hide animation is whatever `app.json` declares.
 */
export const splash = {
  preventAutoHide: (): void => {
    // NOTE: bootstrap best effort, allow-listed: a device with no native splash to hold carries on.
    void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  },
  hide: (): void => {
    // NOTE: bootstrap best effort, allow-listed: a splash already gone is the outcome wanted.
    void SplashScreen.hideAsync().catch(() => undefined);
  },
};
