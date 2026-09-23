/**
 * One routine item's targets (sets, reps, weight, rest), as a form sheet.
 *
 * Opened from the builder (`target=draft`, writes into the draft store) or from a saved
 * routine (`target=routine&id=`, writes through the item mutation). Steppers write on every
 * press, so the sheet is a surface for adjusting rather than a form to submit: Done closes it,
 * and there is nothing to cancel.
 */
import { useCallback, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/i18n/useT';
import { useRemoveRoutineItem, useRoutine, useSetRoutineItem } from '@/queries/useRoutines';
import type { ItemTarget } from '@/routines/draft';
import { removeDraftItem, updateDraftItem, useRoutineDraft } from '@/routines/draftStore';
import { haptics } from '@/services/haptics';
import { useSettings } from '@/settings';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { ItemEditorForm } from '@/ui/routineItems';

export default function RoutineItemSheet() {
  const { target, id, item } = useLocalSearchParams<{ target?: string; id?: string; item: string }>();
  return target === 'routine' && id ? (
    <SavedItem routineId={id} itemId={item} />
  ) : (
    <DraftItem itemId={item} />
  );
}

function DraftItem({ itemId }: { itemId: string }) {
  const draft = useRoutineDraft();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const item = draft.items.find((row) => row.id === itemId) ?? null;
  const snapshot = useMemo(
    () => (item ? (draft.snapshots.find((s) => s.exerciseId === item.exerciseId) ?? null) : null),
    [draft.snapshots, item],
  );
  const change = useCallback((patch: Partial<ItemTarget>) => updateDraftItem(itemId, patch), [itemId]);
  const remove = useCallback(() => {
    removeDraftItem(itemId);
    closeSheet();
  }, [itemId]);
  return (
    <FormSheet title={item?.exerciseName ?? ''} scroll>
      {item ? (
        <ItemEditorForm
          item={item}
          snapshot={snapshot}
          units={units}
          defaultRestSeconds={defaultRest}
          onChange={change}
          onRemove={remove}
        />
      ) : null}
    </FormSheet>
  );
}

function SavedItem({ routineId, itemId }: { routineId: string; itemId: string }) {
  const { t } = useT();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routine, snapshots } = useRoutine(routineId);
  const setItem = useSetRoutineItem();
  const removeItem = useRemoveRoutineItem();
  const item = routine?.items.find((row) => row.id === itemId) ?? null;
  const snapshot = item ? (snapshots.get(item.exerciseId) ?? null) : null;

  const change = useCallback(
    (patch: Partial<ItemTarget>) => {
      // Fire-and-forget: a stepper fires on every tap, and a pending state per press would
      // make the sheet feel broken for a one-row indexed update on this device.
      void setItem.mutateAsync({ routineId, itemId, patch }).catch(() => haptics.warning());
    },
    [itemId, routineId, setItem],
  );
  const remove = useCallback(() => {
    haptics.light();
    void removeItem.mutateAsync({ routineId, itemId }).catch(() => haptics.warning());
    closeSheet();
  }, [itemId, removeItem, routineId]);

  return (
    <FormSheet title={item?.exerciseName ?? t('routine.title')} scroll>
      {item ? (
        <ItemEditorForm
          item={item}
          snapshot={snapshot}
          units={units}
          defaultRestSeconds={defaultRest}
          onChange={change}
          onRemove={remove}
        />
      ) : null}
    </FormSheet>
  );
}
