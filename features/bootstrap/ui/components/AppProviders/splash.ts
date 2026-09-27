import * as SplashScreen from 'expo-splash-screen';

/**
 * The native splash, held until the first frame worth drawing. Unawaited on purpose: awaiting at
 * module scope would put a rejection in front of React's own error handling, and a device with no
 * native splash to hold simply carries on. The hide animation is whatever `app.json` declares.
 */
export const splash = {
  preventAutoHide: (): void => {
    void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  },
  hide: (): void => {
    void SplashScreen.hideAsync().catch(() => undefined);
  },
};
