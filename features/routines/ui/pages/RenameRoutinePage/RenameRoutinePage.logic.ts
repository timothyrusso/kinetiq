import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { closeSheet } from '@/features/core/design-system';
import { useErrorMessage } from '@/features/core/error';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import { routineIdOf } from '@/features/routines/domain/utils/routineId';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import { useRenameRoutine } from '@/features/routines/facades/useRoutineMutations';

/**
 * Renaming a saved routine. An empty name is refused inline, where the typing happened, and so is
 * a name another routine already has; a failed write says the name did not change.
 */
export function useRenameRoutinePageLogic() {
  const { t } = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routineIdOf(params.id);
  const { routine } = useRoutine(id);
  const rename = useRenameRoutine();
  const [name, setName] = useState<string | null>(null);
  const [required, setRequired] = useState(false);
  const failure = useErrorMessage(rename.error);

  const current = name ?? routine?.name ?? '';
  const trimmed = current.trim();

  const { reset } = rename;
  const change = useCallback(
    (next: string) => {
      setName(next);
      setRequired(false);
      reset();
    },
    [reset],
  );

  const { mutate } = rename;
  const commit = useCallback(() => {
    if (id === null) return;
    if (trimmed.length === 0) {
      setRequired(true);
      haptics.warning();
      return;
    }
    mutate(
      { id, name: trimmed },
      {
        onSuccess: () => {
          haptics.success();
          closeSheet();
        },
        onError: () => haptics.warning(),
      },
    );
  }, [id, mutate, trimmed]);

  const error = required
    ? t('routine.nameRequired')
    : rename.error === null
      ? null
      : rename.error._tag === 'RoutineNameTaken'
        ? (failure ?? null)
        : t('routine.renameFailed');

  return {
    state: { name: current, saving: rename.isPending },
    derived: { error },
    effects: { change, commit },
  };
}
