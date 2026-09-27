import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { closeSheet } from '@/features/core/design-system';
import { useSettings } from '@/features/settings';
import { useSetEditor } from '@/features/workouts/hooks/useSetEditor';

/** The set the route names, by position in the workout in progress, and its two writers. */
export function useSetPageLogic() {
  const params = useLocalSearchParams<{ entry: string; set: string }>();
  const units = useSettings(settings => settings.unitSystem);
  const { entry, set, change, remove } = useSetEditor(Number(params.entry), Number(params.set));
  const removeAndClose = useCallback(() => {
    remove();
    closeSheet();
  }, [remove]);
  return { state: { entry, set, units }, effects: { change, remove: removeAndClose } };
}
