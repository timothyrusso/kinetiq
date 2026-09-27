import { useSplashHandoverLogic } from '@/features/bootstrap/ui/components/SplashHandover/SplashHandover.logic';
import { SplashCover } from '@/features/core/design-system';

/** Only one splash, whenever it can be: see the ViewModel. */
export function SplashHandover({ systemDark }: { systemDark: boolean }) {
  const { state, effects } = useSplashHandoverLogic(systemDark);
  return state.covering ? <SplashCover onFadeStart={effects.hideSplash} /> : null;
}
