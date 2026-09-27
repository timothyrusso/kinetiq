import { useCallback, useState } from 'react';
import { useEffectMutation } from '@/features/core/query';
import { resetLocalData } from '@/features/core/sqlite';

/**
 * The launch's reset, behind a confirmation: wipes the user's data over the connection the
 * runtime opened, keeping the schema and the exercise catalog, and runs the migrations again,
 * then calls `onReset` to launch again. Best effort: if the database never opened there is
 * nothing to clear, and the new launch meets the same problem, which the fatal screen then names.
 */
export function useConfirmedReset(onReset: () => void, warn: () => void) {
  const [confirming, setConfirming] = useState(false);
  const { mutate: reset, isError: failed } = useEffectMutation({ mutationFn: () => resetLocalData });
  const ask = useCallback(() => {
    warn();
    setConfirming(true);
  }, [warn]);
  const keep = useCallback(() => setConfirming(false), []);
  const confirm = useCallback(
    () =>
      reset(undefined, {
        onSettled: () => {
          setConfirming(false);
          onReset();
        },
      }),
    [onReset, reset],
  );
  return { confirming, failed, ask, keep, confirm };
}
