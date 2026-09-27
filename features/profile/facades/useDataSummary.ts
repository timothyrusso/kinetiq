import Constants from 'expo-constants';
import { useMemo } from 'react';
import { CATALOG_PROVIDER } from '@/features/exercises';
import { useRoutines } from '@/features/routines';
import { useActivities } from '@/features/workouts';

/**
 * What the About screen says is on the device and what this build is. The counts read Home's own
 * history query and the routines' list, so they render from caches the app has already filled: a
 * second query for "how many workouts" would be a second source of truth for one number. The
 * version is `app.json`'s, the same field stamped into the binary.
 */
export function useDataSummary() {
  const history = useActivities();
  const { routines, isLoading: routinesLoading } = useRoutines();
  const config = Constants.expoConfig;
  return useMemo(
    () => ({
      version: config?.version ?? null,
      appId: config?.ios?.bundleIdentifier ?? config?.android?.package ?? config?.slug ?? null,
      catalogProvider: CATALOG_PROVIDER,
      activityCount: history.activities.length,
      activitiesLoading: history.isLoading,
      routineCount: routines.length,
      routinesLoading,
    }),
    [config, history.activities.length, history.isLoading, routines.length, routinesLoading],
  );
}
