/**
 * The exercise library, pushed over an exercise's detail ("browse similar", a muscle or
 * equipment tag), so back returns to that exercise.
 *
 * It owns its filter: a store built from the params it was pushed with, registered so its
 * filter sheet can find it, and dropped on unmount. Browsing from exercise A, then B, and
 * walking back leaves A's list on A's filter, and the tab's filter is never touched.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { emptyFilter } from '@/api/types';
import { createExerciseFilterStore, registerExerciseFilter } from '@/queries/exerciseFilters';
import { ExerciseLibrary } from '@/ui/exerciseLibrary';

type Params = { query?: string; muscleId?: string; equipmentId?: string };

export default function ExerciseBrowseScreen() {
  const params = useLocalSearchParams<Params>();
  // Built once from the params the screen was pushed with; later edits are the store's.
  const [store] = useState(() =>
    createExerciseFilterStore({
      ...emptyFilter(typeof params.query === 'string' ? params.query : ''),
      muscleId: idParam(params.muscleId),
      equipmentId: idParam(params.equipmentId),
    }),
  );
  const [storeKey, setStoreKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    const registration = registerExerciseFilter(store);
    setStoreKey(registration.key);
    return registration.release;
  }, [store]);

  return <ExerciseLibrary store={store} {...(storeKey !== undefined ? { storeKey } : {})} />;
}

function idParam(value: string | string[] | undefined): number | null {
  const id = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(id) ? id : null;
}
