import { Clock, Effect } from 'effect';
import type { AppError } from '@/features/core/error';
import {
  type CatalogLanguage,
  type Exercise,
  ExerciseCatalog,
  type ExerciseSnapshot,
  ExerciseSnapshotRepository,
  snapshotOf,
} from '@/features/exercises';
import type { ParsedItem, ParsedRoutine } from '@/features/transfer/domain/entities/ParsedImport';
import type { ExerciseMatch, ResolvedItem, ResolvedRoutine } from '@/features/transfer/domain/entities/ResolvedImport';
import { matchKey, normaliseName } from '@/features/transfer/domain/utils/matchRules';

type Match = ExerciseMatch<ExerciseSnapshot>;

const frozen = (exercise: Exercise) => Effect.map(Clock.currentTimeMillis, now => snapshotOf(exercise, now));

const matchItem = (item: ParsedItem, language: CatalogLanguage) =>
  Effect.gen(function* () {
    const stored = yield* ExerciseSnapshotRepository;
    const catalog = yield* ExerciseCatalog;
    // NOTE: each catalog step may fail on its own: a failed id lookup must not stop a stored
    // name match from being found.
    const attempt = <A>(step: Effect.Effect<A | undefined, AppError>) =>
      step.pipe(Effect.catchAll(() => Effect.succeed(undefined)));

    const { exerciseId, exerciseName } = item;
    if (exerciseId !== null) {
      const byId = yield* stored.byId(exerciseId);
      if (byId) return { status: 'stored', snapshot: byId } satisfies Match;
      const remote = yield* attempt(catalog.find(exerciseId, language));
      if (remote) return { status: 'catalog', snapshot: yield* frozen(remote) } satisfies Match;
    }
    if (exerciseName !== '') {
      const byName = yield* stored.byName(exerciseName);
      if (byName) return { status: 'stored', snapshot: byName } satisfies Match;
      const found = (yield* attempt(catalog.search(exerciseName, language))) ?? [];
      const wanted = normaliseName(exerciseName);
      const exact = found.find(exercise => normaliseName(exercise.name) === wanted);
      if (exact) return { status: 'catalog', snapshot: yield* frozen(exact) } satisfies Match;
      const first = found[0];
      if (first) return { status: 'closest', snapshot: yield* frozen(first) } satisfies Match;
    }
    return { status: 'missing' } satisfies Match;
  });

/**
 * Matches every parsed item to a real exercise, in this order: the id among stored exercises
 * (every routine that went out through Export and is coming back), the id in the catalog, the
 * name among stored exercises, then the name in the catalog, where an exact name wins and
 * otherwise the top result is used and marked `closest`, so the preview shows what "Flat bench"
 * became. An id the catalog does not know falls through to the name: an AI that cannot browse
 * invents ids and nearly always gets names right.
 *
 * An item that matches nothing is kept as `missing`, never invented: a name with no catalog row
 * behind it would be an exercise with no muscles, no picture and no instructions. The same
 * exercise in four routines of a split is one lookup, and the lookups run one after another.
 */
export const resolveExercisesByName = (routines: readonly ParsedRoutine[], language: CatalogLanguage) =>
  Effect.gen(function* () {
    const matches = new Map<string, Match>();
    const resolved: ResolvedRoutine<ExerciseSnapshot>[] = [];
    for (const routine of routines) {
      const items: ResolvedItem<ExerciseSnapshot>[] = [];
      for (const item of routine.items) {
        const key = matchKey(item);
        let match = matches.get(key);
        if (match === undefined) {
          match = yield* matchItem(item, language);
          matches.set(key, match);
        }
        items.push({ ...item, match });
      }
      resolved.push({ ...routine, items });
    }
    return resolved;
  });
