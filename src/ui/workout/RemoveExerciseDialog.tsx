import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { useT } from '@/i18n/useT';

/**
 * Removing an exercise from a workout in progress.
 *
 * Confirmed, unlike skipping. Skipping leaves the exercise in the list with its sets
 * un-ticked: recoverable, so no prompt. Removing deletes the entry and the sets already
 * banked against it, so it goes through the same confirm path as discarding the workout.
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
