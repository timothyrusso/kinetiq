/**
 * Downloads the whole wger catalog as one `CatalogPayload`.
 *
 * Pure apart from the transport, which is injected: the snapshot script passes Node's `fetch`,
 * the in-app refresh passes the app's HTTP client. Both then get the same payload, and the same
 * `replaceCatalog` writes it.
 *
 * All-or-nothing by construction: every page is held in memory and the payload only exists once
 * the last page has arrived. A failure anywhere throws, and nothing has been written.
 *
 * No `language__code` is sent. Without it `exerciseinfo` returns every translation of every row,
 * and the mapper keeps the English and Italian ones; with it, wger would also narrow *which
 * exercises* come back.
 */
import type {
  WgerExerciseInfo,
  WgerLanguageResponse,
  WgerListResponse,
  WgerMuscleResponse,
  WgerTaxonomyResponse,
} from '@/api/wger/dto';
import { catalogExerciseMapper, mapLanguageCodes, mapMuscles, mapNamedEntities } from '@/api/wger/mappers';
import type { CatalogExercise, CatalogLanguage, CatalogPayload } from './types';

export const WGER_BASE_URL = 'https://wger.de/api/v2/';

/** Asked for per page. wger honours 100 today; the loop follows whatever it actually returns. */
const PAGE_SIZE = 100;

/** Taxonomy and language endpoints hold a few dozen rows; one page is plenty. */
const SMALL_LIMIT = 100;

/** GETs a URL and resolves with the parsed JSON body. Throws on any failure. */
export type FetchJson = (url: string) => Promise<unknown>;

export type FetchCatalogOptions = {
  now?: () => number;
  log?: (message: string) => void;
};

function url(path: string, params: Record<string, number>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${WGER_BASE_URL}${path}?${query}`;
}

export async function fetchCatalog(
  fetchJson: FetchJson,
  { now = Date.now, log = () => undefined }: FetchCatalogOptions = {},
): Promise<CatalogPayload> {
  const generatedAt = now();
  const [languages, categories, equipment, muscles] = await Promise.all([
    fetchJson(url('language/', { limit: SMALL_LIMIT })) as Promise<WgerLanguageResponse>,
    fetchJson(url('exercisecategory/', { limit: SMALL_LIMIT })) as Promise<WgerTaxonomyResponse>,
    fetchJson(url('equipment/', { limit: SMALL_LIMIT })) as Promise<WgerTaxonomyResponse>,
    fetchJson(url('muscle/', { limit: SMALL_LIMIT })) as Promise<WgerMuscleResponse>,
  ]);

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

  // Offset paging that trusts the rows over `next`: the server echoes an absolute URL, and an
  // empty page is the real end whatever `next` claims.
  const rows: WgerExerciseInfo[] = [];
  let pages = 0;
  let total: number | null = null;
  for (;;) {
    const page = (await fetchJson(
      url('exerciseinfo/', { limit: PAGE_SIZE, offset: rows.length }),
    )) as WgerListResponse<WgerExerciseInfo>;
    pages += 1;
    total = typeof page.count === 'number' ? page.count : total;
    const results = page.results ?? [];
    rows.push(...results);
    if (results.length === 0 || (total !== null && rows.length >= total)) break;
  }

  const byId = new Map<number, CatalogExercise>();
  for (const row of rows) {
    const exercise = map(row);
    if (exercise !== null && !byId.has(exercise.externalId)) byId.set(exercise.externalId, exercise);
  }
  const exercises = [...byId.values()].sort((a, b) => a.externalId - b.externalId);
  log(`wger: ${rows.length} of ${total ?? '?'} exercises in ${pages} pages, ${exercises.length} kept`);

  const byNumericId = <T extends { id: number }>(list: T[]) => [...list].sort((a, b) => a.id - b.id);
  return {
    formatVersion: 1,
    source: 'wger',
    generatedAt,
    categories: byNumericId(taxonomy.categories),
    equipment: byNumericId(taxonomy.equipment),
    muscles: byNumericId(taxonomy.muscles),
    exercises,
  };
}
