/**
 * One set of the live workout, as a form sheet.
 *
 * The set is read from the session by index on every render, not held in state: the engine
 * writes through on each stepper press, and a snapshot would freeze the sheet at the moment it
 * opened while the row behind it moved. Closing is committing, so the only header action is
 * Done; the destructive Remove sits in the content where it cannot be mistaken for it.
 */
import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/i18n/useT';
import { useSettings } from '@/settings';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { SetEditorForm } from '@/ui/workout';
import { removeSet, updateSet, useWorkoutSession } from '@/workout/session';

export default function SetEditorSheet() {
  const { t } = useT();
  const params = useLocalSearchParams<{ entry: string; set: string }>();
  const entryIndex = Number(params.entry);
  const setIndex = Number(params.set);
  const { session } = useWorkoutSession();
  const units = useSettings((s) => s.unitSystem);
  const entry = session?.entries[entryIndex];
  const set = entry?.sets[setIndex];

  const change = useCallback(
    (patch: { reps?: number; weightKg?: number; rpe?: number | null }) =>
      updateSet(entryIndex, setIndex, patch),
    [entryIndex, setIndex],
  );
  const remove = useCallback(() => {
    removeSet(entryIndex, setIndex);
    closeSheet();
  }, [entryIndex, setIndex]);

  return (
    <FormSheet title={t('setRow.thisSet')}>
      {entry && set ? (
        <SetEditorForm entry={entry} set={set} units={units} onChange={change} onRemove={remove} />
      ) : null}
    </FormSheet>
  );
}
