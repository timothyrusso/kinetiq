/**
 * Routine queries and mutations.
 *
 * Routines are local-first: the source of truth is SQLite, never the API. TanStack
 * Query is used here for its cache-identity and invalidation properties rather than
 * for network abstraction: several screens show the same routine (the Workout tab,
 * the routine detail, the session screen's header) and they must agree without any
 * of them holding a copy.
 *
 * ## Why every mutation invalidates rather than patches
 *
 * A routine's items live in their own table, and `save` replaces them wholesale
 * inside a transaction. Writing the new list into the cache by hand would mean
 * re-implementing that join in the client: and getting it subtly wrong, e.g. a
 * cache that shows a reordered list while the row order on disk says otherwise.
 * The reads are a couple of indexed queries on a table with dozens of rows; the
 * re-read costs nothing and cannot disagree with the database.
 *
 * Optimistic updates would also be actively harmful here: the only mutation the
 * user can feel is a reorder, and a reorder that renders before the transaction
 * commits can be dragged again against a stale index.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/query/keys';
import { invalidateRoutines } from '@/query/invalidation';
import {
  activityRepository,
  routineRepository,
  snapshotOf,
  type RoutineDraft,
} from '@/persistence';
import type { Exercise, RoutineItem, StrengthEntry } from '@/domain/types';
import { estimatedOneRepMax } from '@/domain/logic';
import { repsFromRange } from '@/utils/format';
import { localId } from '@/utils/functional';

/* ------------------------------------------------------------------ reads -- */

export function useRoutines() {
  const query = useQuery({
    queryKey: queryKeys.routines.list(),
    queryFn: () => routineRepository.list(),
  });
  const routines = useMemo(() => query.data ?? [], [query.data]);
  return {
    routines,
    count: routines.length,
    isEmpty: query.status === 'success' && routines.length === 0,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}

/**
 * One routine, plus the snapshots its items reference.
 *
 * Both are fetched here and combined because they are always needed together: a
 * routine screen that renders items without their snapshots has no image, no
 * muscle group and no instructions, and would have to fetch the second map on the
 * next render anyway. Combining also means the pair cannot be observed half-loaded.
 */
export function useRoutine(id: string | null) {
  const query = useQuery({
    queryKey: queryKeys.routines.detail(id ?? 'none'),
    queryFn: async () => {
      if (!id) return null;
      const routine = await routineRepository.byId(id);
      if (!routine) return null;
      const snapshots = await routineRepository.snapshotsFor(id);
      return { routine, snapshots };
    },
    enabled: id !== null,
  });

  return {
    routine: query.data?.routine ?? null,
    snapshots: query.data?.snapshots ?? new Map(),
    /** True once the query settled and found nothing: distinct from still loading. */
    missing: query.status === 'success' && query.data === null,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}

/* -------------------------------------------------------------- mutations -- */

/** Create or rename/resave a routine. Returns the saved row so callers can navigate to it. */
export function useSaveRoutine() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: RoutineDraft) => routineRepository.save(draft),
    onSuccess: (saved) => {
      invalidateRoutines(client);
      // The detail key for the routine just written is stale even though the list
      // is too: a screen that was showing it while the user edited elsewhere must
      // not keep the pre-save item list.
      void client.invalidateQueries({ queryKey: queryKeys.routines.detail(saved.id) });
    },
  });
}

export function useDeleteRoutine() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => routineRepository.remove(id),
    onSuccess: (_result, id) => {
      invalidateRoutines(client);
      // Removing a routine must not leave its detail cached: the delete sheet is
      // often opened from the detail screen itself, and a `removeQueries` here is
      // what stops that screen re-rendering a corpse on the way out.
      client.removeQueries({ queryKey: queryKeys.routines.detail(id) });
    },
  });
}

/**
 * Duplicates a routine. Returns the copy so the caller can open it immediately, * duplicating and then being left on the original is the confusing half of the
 * interaction, and it is the reason this is not just `save` with a new id.
 */
export function useDuplicateRoutine() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const copy = await routineRepository.duplicate(id, name);
      if (!copy) throw new Error('That routine no longer exists.');
      return copy;
    },
    onSuccess: (copy) => {
      invalidateRoutines(client);
      void client.invalidateQueries({ queryKey: queryKeys.routines.detail(copy.id) });
    },
  });
}

export function useRenameRoutine() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await routineRepository.rename(id, name);
      const updated = await routineRepository.byId(id);
      if (!updated) throw new Error('That routine no longer exists.');
      return updated;
    },
    onSuccess: (_result, variables) => {
      invalidateRoutines(client);
      void client.invalidateQueries({
        queryKey: queryKeys.routines.detail(variables.id),
      });
    },
  });
}

/**
 * Reorders by the full ordered id list rather than by a from/to pair.
 *
 * A drag gesture ends with the list it is showing, and sending that list is the
 * only version of this call that cannot be wrong: a from/to index is interpreted
 * against whatever order the database currently holds, which differs from the
 * gesture's if a concurrent save landed first.
 */
export function useReorderRoutine() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orderedItemIds }: { id: string; orderedItemIds: string[] }) => {
      await routineRepository.reorder(id, orderedItemIds);
    },
    onSuccess: (_result, variables) => {
      void client.invalidateQueries({ queryKey: queryKeys.routines.detail(variables.id) });
      void client.invalidateQueries({ queryKey: queryKeys.routines.list() });
    },
  });
}

export function useSetRoutineItem() {
  const client = useQueryClient();
  return useMutation({
    // `routineId` is in the variables purely so `onSuccess` can target the right
    // detail key; the repository addresses an item by its own id.
    mutationFn: async ({
      itemId,
      patch,
    }: {
      routineId: string;
      itemId: string;
      patch: {
        sets?: number;
        reps?: string;
        weightKg?: number;
        restSeconds?: number;
        notes?: string | null;
      };
    }) => {
      await routineRepository.setItem(itemId, patch);
    },
    onSuccess: (_result, variables) => {
      void client.invalidateQueries({
        queryKey: queryKeys.routines.detail(variables.routineId),
      });
    },
  });
}

/**
 * Adds an exercise to a routine, storing its snapshot in the same transaction.
 *
 * This is the only write path that takes a *remote* exercise, and it is the seam
 * that makes offline routines work: `snapshotOf` freezes the wger response into the
 * local `exercises` table, so from this point on the routine renders identically
 * with or without a network. Nothing downstream ever re-fetches to draw a routine.
 */
export function useAddRoutineExercise() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routineId,
      exercise,
      item,
    }: {
      routineId: string;
      exercise: Exercise;
      item: Omit<RoutineItem, 'id' | 'exerciseId' | 'exerciseName'>;
    }) => {
      const snapshot = snapshotOf(exercise);
      // Snapshot and item go in together: `addItem` upserts the snapshot inside the
      // same transaction it inserts the row in, so there is no window where a
      // routine item points at an exercise id that is not stored locally.
      await routineRepository.addItem(
        routineId,
        {
          ...item,
          id: localId('rit'),
          exerciseId: exercise.id,
          exerciseName: exercise.name,
        },
        snapshot,
      );
    },
    onSuccess: (_result, variables) => {
      void client.invalidateQueries({
        queryKey: queryKeys.routines.detail(variables.routineId),
      });
      void client.invalidateQueries({ queryKey: queryKeys.routines.list() });
    },
  });
}

export function useRemoveRoutineItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ routineId, itemId }: { routineId: string; itemId: string }) => {
      await routineRepository.removeItem(routineId, itemId);
    },
    onSuccess: (_result, variables) => {
      void client.invalidateQueries({
        queryKey: queryKeys.routines.detail(variables.routineId),
      });
    },
  });
}

/* -------------------------------------------------- previous performance -- */

export type PreviousLift = {
  exerciseId: string;
  exerciseName: string;
  /** Sets from the most recent session that included this exercise. */
  sets: { reps: number; weightKg: number; estimated1rm: number | null }[];
  bestEstimated1rm: number | null;
  totalVolumeKg: number;
  performedAt: number;
};

/**
 * What the user lifted last time, per exercise in this routine.
 *
 * This is the single most valuable thing a strength screen can show: it is what
 * tells someone whether to add weight: and it is expensive to compute naively,
 * because "last time" means scanning history per exercise. One query per routine
 * does it once: fetch the most recent strength sessions, then index them by
 * exercise id, keeping the first occurrence of each.
 *
 * Keyed on `routineId` rather than on the session, so finishing a workout
 * invalidates exactly the routine that was performed (`invalidateAfterWorkout`)
 * and nothing else.
 */
export function usePreviousPerformance(routineId: string | null, exerciseIds: readonly string[] = []) {
  const wanted = useMemo(() => new Set(exerciseIds), [exerciseIds]);

  const query = useQuery({
    queryKey: routineId
      ? queryKeys.session.previousPerformance(routineId)
      : ['session', 'previous', 'none'],
    queryFn: async () => {
      // A deliberately generous window: someone who trains a routine fortnightly
      // would get "no previous data" from a 4-week scan, and "no previous data" is
      // the answer only when there genuinely is none.
      const history = await activityRepository.list({ kinds: ['lift'], order: 'desc', limit: 24 });
      const byExercise = new Map<string, PreviousLift>();

      // `history` is newest-first, so the first hit per exercise *is* the last time.
      for (const activity of history) {
        for (const entry of activity.strength?.entries ?? []) {
          if (wanted.size > 0 && !wanted.has(entry.exerciseId)) continue;
          if (byExercise.has(entry.exerciseId)) continue;
          const done = entry.sets.filter((s) => s.completed || s.reps > 0);
          const best = done.reduce<number | null>((acc, s) => {
            const oneRm = s.estimated1rm ?? estimatedOneRepMax(s.weightKg, s.reps);
            return oneRm === null ? acc : acc === null || oneRm > acc ? oneRm : acc;
          }, null);
          byExercise.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            exerciseName: entry.exerciseName,
            sets: done.map((s) => ({
              reps: s.reps,
              weightKg: s.weightKg,
              estimated1rm: s.estimated1rm ?? estimatedOneRepMax(s.weightKg, s.reps),
            })),
            bestEstimated1rm: best,
            totalVolumeKg: entry.sets.reduce(
              (acc, s) => acc + s.reps * s.weightKg,
              0,
            ),
            performedAt: activity.startedAt,
          });
        }
        if (wanted.size > 0 && byExercise.size >= wanted.size) break;
      }
      return byExercise;
    },
    enabled: routineId !== null,
    staleTime: 60_000,
  });

  const previous = query.data ?? new Map<string, PreviousLift>();
  const get = useCallback((exerciseId: string) => previous.get(exerciseId), [previous]);
  return { get, previous, isLoading: query.isLoading, error: query.error };
}

/* ---------------------------------------------------------------- helpers -- */

/**
 * Turns a routine's items into the empty set of entries a new session starts from.
 *
 * Lives here rather than in the session module because it needs to know that
 * `weightKg: 0` means bodyweight and that `reps` is a string a program may have put
 * "5-8" into: i.e. it is a routine-shape concern, not a session-engine one. The rep number
 * comes from `repsFromRange` so the set the session opens with holds the same number the
 * routine screen displayed for it.
 */
export function entriesFromItems(items: readonly RoutineItem[]): StrengthEntry[] {
  return items.map((item) => ({
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    muscleGroup: null,
    restSeconds: item.restSeconds,
    notes: item.notes,
    sets: Array.from({ length: Math.max(1, item.sets) }, (_, index) => ({
      index,
      reps: repsFromRange(item.reps),
      weightKg: item.weightKg,
      completed: false,
      estimated1rm: null,
      rpe: null,
    })),
  }));
}
