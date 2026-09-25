/**
 * Matches parsed routine items to real exercises, and writes the result.
 *
 * ## Match order
 *
 * 1. The id, if the user already has that exercise stored. No network, and it is the case for
 *    every routine that went out through Export and is coming back.
 * 2. The id, looked up in the catalog. An AI that can browse wger sends real ids.
 * 3. The name, among stored exercises (exact, ignoring case).
 * 4. The name, searched in the catalog. An exact name wins; otherwise the top result is used
 *    and marked `closest`, so the preview can show the user what "Flat bench" became.
 *
 * An id that the catalog does not know falls through to the name, because an AI that cannot
 * browse sometimes invents ids and nearly always gets names right.
 *
 * ## Why items that match nothing are dropped, not invented
 *
 * `routine_items.exercise_id` must point at a stored exercise, and a stored exercise is a
 * snapshot of catalog data. A name with no catalog row behind it would be an exercise with no
 * muscles, no picture and no instructions that nothing could ever refresh. The preview lists
 * what was dropped, and says when the reason is being offline rather than a bad name.
 */
import { FIRST_PAGE } from '@/api/types';
import { getExerciseProvider, isOfflineError } from '@/api';
import type { ExerciseProvider } from '@/api';
import { externalIdOf } from '@/domain/exerciseId';
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import {
  routineRepository,
  snapshotById,
  snapshotByName,
  snapshotOf,
  type RoutineDraft,
} from '@/persistence';
import { localId } from '@/utils/functional';
import type { ParsedItem, ParsedRoutine } from './parseRoutines';

type Match =
  | { status: 'stored' | 'catalog' | 'closest'; snapshot: ExerciseSnapshot }
  | { status: 'missing'; offline: boolean };

export type ResolvedItem = ParsedItem & { match: Match };
export type ResolvedRoutine = Omit<ParsedRoutine, 'items'> & { items: ResolvedItem[] };

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function byCatalogId(
  provider: ExerciseProvider,
  id: string,
  signal?: AbortSignal,
): Promise<ExerciseSnapshot | null> {
  const externalId = externalIdOf(id);
  if (externalId === null) return null;
  const exercise = await provider.byId(externalId, signal);
  return exercise ? snapshotOf(exercise) : null;
}

async function byCatalogName(
  provider: ExerciseProvider,
  name: string,
  signal?: AbortSignal,
): Promise<Match | null> {
  const page = await provider.page(
    { query: name, categoryId: null, equipmentId: null, muscleId: null },
    FIRST_PAGE,
    signal,
  );
  const wanted = normalise(name);
  const exact = page.items.find((e) => normalise(e.name) === wanted);
  if (exact) return { status: 'catalog', snapshot: snapshotOf(exact) };
  const first = page.items[0];
  return first ? { status: 'closest', snapshot: snapshotOf(first) } : null;
}

async function matchItem(provider: ExerciseProvider, item: ParsedItem, signal?: AbortSignal): Promise<Match> {
  let offline = false;
  // Each catalog step is allowed to fail on its own: an offline id lookup must not stop a
  // stored-name match from being found.
  const attempt = async <T>(step: () => Promise<T | null>): Promise<T | null> => {
    try {
      return await step();
    } catch (error) {
      if (isOfflineError(error)) offline = true;
      return null;
    }
  };

  if (item.exerciseId !== null) {
    const stored = await snapshotById(item.exerciseId);
    if (stored) return { status: 'stored', snapshot: stored };
    if (!offline) {
      const remote = await attempt(() => byCatalogId(provider, item.exerciseId!, signal));
      if (remote) return { status: 'catalog', snapshot: remote };
    }
  }
  if (item.exerciseName !== '') {
    const stored = await snapshotByName(item.exerciseName);
    if (stored) return { status: 'stored', snapshot: stored };
    if (!offline) {
      const found = await attempt(() => byCatalogName(provider, item.exerciseName, signal));
      if (found) return found;
    }
  }
  return { status: 'missing', offline };
}

export async function resolveRoutines(
  routines: readonly ParsedRoutine[],
  signal?: AbortSignal,
): Promise<ResolvedRoutine[]> {
  const provider = getExerciseProvider();
  // The same exercise in four routines of a split is one lookup, not four requests.
  const cache = new Map<string, Promise<Match>>();
  const lookup = (item: ParsedItem) => {
    const key = `${item.exerciseId ?? ''}|${normalise(item.exerciseName)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = matchItem(provider, item, signal);
      cache.set(key, pending);
    }
    return pending;
  };

  const resolved: ResolvedRoutine[] = [];
  // Sequential on purpose: wger rate-limits, and a split is a few dozen lookups at most.
  for (const routine of routines) {
    const items: ResolvedItem[] = [];
    for (const item of routine.items) items.push({ ...item, match: await lookup(item) });
    resolved.push({ ...routine, items });
  }
  return resolved;
}

/** Routines that have at least one matched item: the ones an import will actually create. */
export function importable(routines: readonly ResolvedRoutine[]): ResolvedRoutine[] {
  return routines.filter((r) => r.items.some((i) => i.match.status !== 'missing'));
}

/**
 * Writes each importable routine as a NEW routine. An import never overwrites: a routine that
 * went out and came back edited lands beside the original, and the user deletes the one they
 * no longer want.
 */
export async function saveImported(
  routines: readonly ResolvedRoutine[],
  names: { fallback: (index: number) => string },
  defaultRestSeconds: number,
): Promise<number> {
  let saved = 0;
  // Numbered over the whole file, so an unnamed routine gets the name the preview showed.
  for (const [index, routine] of routines.entries()) {
    if (!routine.items.some((i) => i.match.status !== 'missing')) continue;
    const items: RoutineItem[] = [];
    const snapshots: ExerciseSnapshot[] = [];
    for (const item of routine.items) {
      if (item.match.status === 'missing') continue;
      const { snapshot } = item.match;
      if (item.match.status !== 'stored') snapshots.push(snapshot);
      items.push({
        id: localId('rit'),
        exerciseId: snapshot.exerciseId,
        exerciseName: snapshot.name,
        sets: item.sets,
        reps: item.reps,
        weightKg: item.weightKg,
        restSeconds: item.restSeconds ?? defaultRestSeconds,
        notes: item.notes,
      });
    }
    const draft: RoutineDraft = {
      name: routine.name ?? names.fallback(index + 1),
      description: routine.description,
      items,
      snapshots,
    };
    await routineRepository.save(draft);
    saved += 1;
  }
  return saved;
}
