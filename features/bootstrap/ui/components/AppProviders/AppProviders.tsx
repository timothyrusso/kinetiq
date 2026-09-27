import type { ReactNode } from 'react';
import { useAppProvidersLogic } from '@/features/bootstrap/ui/components/AppProviders/AppProviders.logic';
import { splash } from '@/features/bootstrap/ui/components/AppProviders/splash';
import { FatalScreen } from '@/features/bootstrap/ui/components/FatalScreen/FatalScreen';
import { LaunchSurface } from '@/features/bootstrap/ui/components/LaunchSurface/LaunchSurface';
import { SplashHandover } from '@/features/bootstrap/ui/components/SplashHandover/SplashHandover';

// NOTE: at module scope, not in an effect: the native splash is torn down the moment React's
// first frame lands, and an effect runs after commit, when the frame it protects has flashed.
splash.preventAutoHide();

/**
 * The launch gate above the navigator: a navigator that mounted while the database was still
 * opening would create scenes, and scenes run their queries. Nothing below can assume anything
 * about the launch, because by the time it mounts the database is migrated, the settings are in
 * the store, the fonts are loaded and an interrupted workout is restored.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const { state, derived, effects } = useAppProvidersLogic();
  if (state.phase === 'ready') {
    return (
      <>
        {children}
        <SplashHandover systemDark={state.systemDark} />
      </>
    );
  }
  if (state.phase === 'failed') {
    return (
      <FatalScreen
        message={derived.failureMessage}
        canReset={derived.canReset}
        onRetry={effects.retry}
        onReset={effects.restart}
      />
    );
  }
  return (
    <LaunchSurface
      dark={state.systemDark}
      slow={state.phase === 'slow'}
      onRetry={effects.retry}
      onReset={effects.restart}
    />
  );
}
