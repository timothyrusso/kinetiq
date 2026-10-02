import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { exerciseLibraryTags, type Tag } from '@/features/core/design-system';
import { useExercise } from '@/features/exercises';
import { useSettings } from '@/features/settings';
import { useExerciseEditor } from '@/features/workouts/hooks/useExerciseEditor';

const NO_TAGS: readonly Tag[] = [];

/** A route param as a position, or `null` when it is absent or not one. */
function positionOf(param: string | undefined): number | null {
  if (param === undefined || param === '') return null;
  const value = Number(param);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * The exercise the route names, by position in the workout in progress, and its writers. `set`
 * names the set that was tapped, highlighted and scrolled to; the exercise's name opens the sheet
 * with none. The library's tags come from the exercise as the library knows it, the same source
 * the About block reads, since a session keeps no snapshot of its own.
 */
export function useSessionExercisePageLogic() {
  const params = useLocalSearchParams<{ entry: string; set?: string }>();
  const entryIndex = positionOf(params.entry) ?? -1;
  const highlightedSet = positionOf(params.set);
  const units = useSettings(settings => settings.unitSystem);
  const { entry, changeSet, addSet, removeSet, changeEntry } = useExerciseEditor(entryIndex);
  const { exercise } = useExercise(entry?.exerciseId ?? null);
  const tags = useMemo<readonly Tag[]>(() => (exercise === null ? NO_TAGS : exerciseLibraryTags(exercise)), [exercise]);
  const highlightRef = useRef<View>(null);
  // NOTE: the first set is already at the top of the sheet; scrolling to it would only hide the
  // summary above it.
  const scrollTo = highlightedSet !== null && highlightedSet > 0 ? highlightRef : undefined;

  return {
    state: { entry, units, highlightedSet },
    derived: { title: entry?.exerciseName ?? '', tags, highlightRef, scrollTo },
    effects: { changeSet, addSet, removeSet, changeEntry },
  };
}
