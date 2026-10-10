import { useCallback, useEffect, useRef } from 'react';
import { useBootstrap } from '@/features/bootstrap/facades/useBootstrap';
import { splash } from '@/features/bootstrap/ui/components/AppProviders/splash';
import { launchColorScheme } from '@/features/core/theme';

/**
 * Longest the splash may stay up before the launch says so. A real cold start is about 600 ms
 * (fonts dominate); five seconds is the point at which something is genuinely wedged, and a
 * spinner that never ends is a worse failure than a screen that offers the two ways out.
 */
const BOOTSTRAP_DEADLINE_MS = 5_000;

/** The message the fatal screen shows: on a production build it is the sentence support would ask for. */
function messageOf(failure: unknown): string {
  if (failure instanceof Error) return failure.message;
  return typeof failure === 'string' ? failure : String(failure);
}

/**
 * Whether the launch failed on the stored data: a migration that failed, or a read that raised
 * `SqlError`. Only then can erasing the local data get the next launch past it.
 */
function isStorageFailure(failure: unknown): boolean {
  return typeof failure === 'object' && failure !== null && '_tag' in failure && failure._tag === 'SqlError';
}

/**
 * The launch gate: runs the bootstrap once, and says which of four things to render: the launch
 * screen, the "still starting" state, the fatal state, or the app. No auto-recovery from a slow
 * start: past the deadline the launch screen offers a retry and a confirmed reset, because
 * rendering the app over a database that is not open would trade one dead screen for a dozen.
 * The OS appearance is the one at launch: the native splash was drawn in it, and once the settings
 * load, the app's theme is applied natively and the live value reports that instead. It is null on
 * some Android emulator images, and dark is the safer guess.
 */
export function useAppProvidersLogic() {
  const systemDark = launchColorScheme() !== 'light';
  const { phase, failure, start, retry: retryLaunch, restart: restartLaunch, markSlow } = useBootstrap();
  const readyAtMount = useRef(phase === 'ready');

  useEffect(() => {
    if (readyAtMount.current) return;
    start(systemDark);
    const deadline = setTimeout(() => {
      markSlow();
      // NOTE: the slow panel is drawn under the held native splash, where nobody could press it.
      splash.hide();
    }, BOOTSTRAP_DEADLINE_MS);
    return () => clearTimeout(deadline);
  }, [markSlow, start, systemDark]);

  useEffect(() => {
    if (phase === 'failed') splash.hide();
  }, [phase]);

  const retry = useCallback(() => retryLaunch(systemDark), [retryLaunch, systemDark]);
  const restart = useCallback(() => restartLaunch(systemDark), [restartLaunch, systemDark]);

  return {
    state: { phase, systemDark },
    derived: {
      failureMessage: phase === 'failed' ? messageOf(failure).slice(0, 400) : '',
      canReset: phase === 'failed' && isStorageFailure(failure),
    },
    effects: { retry, restart },
  };
}
