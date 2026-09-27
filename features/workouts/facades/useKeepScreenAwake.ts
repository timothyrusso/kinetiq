import { useEffect } from 'react';
import { useEffectMutation } from '@/features/core/query';
import { setScreenAwake } from '@/features/workouts/useCases/setScreenAwake';

/**
 * Keeps the screen on while `active`, and lets it sleep when `active` turns false or the caller
 * unmounts. Fired and forgotten: a device that refuses is logged once at the boundary, and the
 * workout carries on with the screen's own timeout.
 */
export function useKeepScreenAwake(active: boolean) {
  const { mutate } = useEffectMutation({ mutationFn: (awake: boolean) => setScreenAwake(awake) });
  useEffect(() => {
    if (!active) return undefined;
    mutate(true);
    return () => mutate(false);
  }, [active, mutate]);
}
