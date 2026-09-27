import { Clock, Effect, type ParseResult, Schema } from 'effect';
import {
  catalogExerciseMapper,
  mapLanguageCodes,
  mapMuscles,
  mapNamedEntities,
} from '@/features/exercises/data/adapters/wgerCatalogMapper';
import {
  WgerExerciseInfo,
  WgerLanguage,
  WgerList,
  WgerMuscle,
  WgerNamedEntity,
} from '@/features/exercises/data/dtos/wgerDtos';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { CatalogExercise, CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

/** Asked for per page. wger honours 100 today; the loop follows whatever it actually returns. */
const PAGE_SIZE = 100;

/** Taxonomy and language endpoints hold a few dozen rows; one page is plenty. */
const SMALL_LIMIT = 100;

const LanguageList = WgerList(WgerLanguage);
const NamedList = WgerList(WgerNamedEntity);
const MuscleList = WgerList(WgerMuscle);
const ExerciseInfoList = WgerList(WgerExerciseInfo);

const byNumericId = <T extends { readonly id: number }>(list: readonly T[]) => [...list].sort((a, b) => a.id - b.id);

/**
 * Downloads the whole wger catalog under `baseUrl` as one `CatalogPayload`.
 *
 * The transport is a parameter: the app passes its HTTP client with retries and timeouts, the
 * snapshot script passes Node's `fetch`, and both get the same payload. `invalid` names the
 * failure for a response that fails its Schema.
 *
 * All or nothing by construction: every page is held in memory and the payload only exists once
 * the last page has arrived. No `language__code` is sent: without it `exerciseinfo` returns every
 * translation of every row, and the mapper keeps the English and Italian ones; with it, wger would
 * also narrow which exercises come back. Paging trusts the rows over `next`: an empty page is the
 * real end whatever `next` claims.
 */
export const downloadWgerCatalog = <E, EI>(
  baseUrl: string,
  getJson: (url: string) => Effect.Effect<unknown, E>,
  invalid: (endpoint: string, cause: ParseResult.ParseError) => EI,
): Effect.Effect<CatalogPayload, E | EI> => {
  const get = <A, I>(path: string, params: Readonly<Record<string, number>>, schema: Schema.Schema<A, I>) => {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return getJson(`${baseUrl}${path}?${query}`).pipe(
      Effect.flatMap(body => Schema.decodeUnknown(schema)(body).pipe(Effect.mapError(cause => invalid(path, cause)))),
    );
  };

  return Effect.gen(function* () {
    const generatedAt = yield* Clock.currentTimeMillis;
    const [languages, categories, equipment, muscles] = yield* Effect.all(
      [
        get('language/', { limit: SMALL_LIMIT }, LanguageList),
        get('exercisecategory/', { limit: SMALL_LIMIT }, NamedList),
        get('equipment/', { limit: SMALL_LIMIT }, NamedList),
        get('muscle/', { limit: SMALL_LIMIT }, MuscleList),
      ],
      { concurrency: 'unbounded' },
    );

    const codes = mapLanguageCodes(languages.results ?? []);
    const idOf = (code: CatalogLanguage): number | null => {
      for (const [id, value] of codes) if (value === code) return id;
      return null;
    };
    const taxonomy = {
      categories: mapNamedEntities(categories.results ?? []),
      equipment: mapNamedEntities(equipment.results ?? []),
      muscles: mapMuscles(muscles.results ?? []),
    };
    const map = catalogExerciseMapper({ en: idOf('en'), it: idOf('it') }, taxonomy);

    const rows: WgerExerciseInfo[] = [];
    let total: number | null = null;
    for (;;) {
      const page = yield* get('exerciseinfo/', { limit: PAGE_SIZE, offset: rows.length }, ExerciseInfoList);
      total = page.count ?? total;
      const results = page.results ?? [];
      rows.push(...results);
      if (results.length === 0 || (total !== null && rows.length >= total)) break;
    }

    const byId = new Map<number, CatalogExercise>();
    for (const row of rows) {
      const exercise = map(row);
      if (exercise !== null && !byId.has(exercise.externalId)) byId.set(exercise.externalId, exercise);
    }

    return {
      formatVersion: 1,
      source: 'wger',
      generatedAt,
      categories: byNumericId(taxonomy.categories),
      equipment: byNumericId(taxonomy.equipment),
      muscles: byNumericId(taxonomy.muscles),
      exercises: [...byId.values()].sort((a, b) => a.externalId - b.externalId),
    } satisfies CatalogPayload;
  });
};
