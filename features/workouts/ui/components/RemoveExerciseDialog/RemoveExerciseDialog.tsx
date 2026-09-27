import { ConfirmDialog } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';

/**
 * Removing an exercise from a workout in progress. Confirmed, unlike skipping: a skip leaves the
 * exercise with its sets unticked, which is recoverable, while a removal deletes the entry and the
 * sets already banked against it, so it takes the same confirm path as discarding the workout.
 */
export function RemoveExerciseDialog({
  exerciseName,
  completedSets,
  onConfirm,
  onRequestClose,
}: {
  exerciseName: string;
  completedSets: number;
  onConfirm: () => void;
  onRequestClose: () => void;
}) {
  const { t } = useT();
  return (
    <ConfirmDialog
      visible
      title={t('setRow.removeExerciseTitle')}
      message={
        completedSets > 0
          ? t('setRow.removeWithSets', { name: exerciseName, count: completedSets })
          : t('setRow.removePlain', { name: exerciseName })
      }
      confirmLabel={t('setRow.remove')}
      cancelLabel={t('common.cancel')}
      destructive
      onConfirm={onConfirm}
      onCancel={onRequestClose}
    />
  );
}
