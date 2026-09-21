/**
 * wger Workout Manager adapter.
 *
 * Endpoint contract, verified against live responses from
 * https://wger.de/api/v2/ (see dto.ts for the per-field notes):
 *
 *  - `exerciseinfo` is the only exercise endpoint worth using: it returns a
 *    complete row including fully-hydrated `images[]` / `videos[]`, so lists and
 *    detail need no follow-up requests.
 *  - Pagination is `limit`/`offset` with `count`/`next`/`previous`. We keep our
 *    own cursor as an offset because `next` URLs echo the request host and are
 *    not opaque enough to treat as a token.
 *  - Search is `name__search` (pg_trgm): fuzzy and relevance-ranked, so
 *    "bech press" finds Bench Press. Plain `search` / `term` / `q` / `name`
 *    exist as parameters but are ignored by the server, which is worse than a
 *    400: it looks like it works and returns the whole catalog.
 *  - `language__code` narrows *which exercises* have a translation in those
 *    languages; it does not strip other languages from `translations[]`. We
 *    therefore still resolve display strings ourselves, and we send the user's
 *    language plus English so nothing disappears just because it is untranslated.
 */
import type { Exercise, ExerciseFilter, ExercisePage, ExerciseTaxonomy } from '@/domain/types';
import { ApiError, requestJson } from '../http';
import type { ExerciseProvider } from '../types';
import type {
  WgerExerciseInfo,
  WgerLanguageResponse,
  WgerListResponse,
  WgerMuscleResponse,
  WgerTaxonomyResponse,
} from './dto';
import {
  WGER_ENGLISH_ID,
  mapExerciseInfo,
  mapLanguageCodes,
  mapMuscleTaxon,
  mapTaxon,
  type LanguagePreference,
} from './mappers';

const BASE_URL = 'https://wger.de/api/v2/';

/**
 * Page size. wger's rows are heavy: every row carries translations in ~16
 * languages plus hydrated media, measured at ~8 KB per row: so a page is about
 * 200 KB. Doubling the page roughly doubles parse time and memory for rows
 * nobody has scrolled to yet.
 */
const PAGE_SIZE = 25;

/** Taxonomy endpoints hold a few dozen rows; one page is plenty. */
const TAXONOMY_LIMIT = 100;

/**
 * Turns a device locale ("fr-CA", "zh-Hans-CN") into wger's numeric language
 * ids, in preference order, always ending with English. English is never
 * dropped: it is the fallback every screen renders when a row has no
 * translation in the user's language.
 */
export function languageIdsFor(code: string | undefined, codes: Map<number, string>): number[] {
  const wanted = (code ?? '').slice(0, 2).toLowerCase();
  const ids: number[] = [];
  if (wanted && wanted !== 'en') {
    for (const [id, value] of codes) if (value === wanted) ids.push(id);
  }
  ids.push(WGER_ENGLISH_ID);
  return ids;
}

export type WgerProviderOptions = {
  /** BCP-47 code from the device, e.g. "fr-CA". May change at runtime. */
  getLanguageCode: () => string | undefined;
};

function parseCursor(cursor: string | null): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
}

export class WgerExerciseProvider implements ExerciseProvider {
  readonly name = 'wger';
  /**
   * False by design: discovery is remote-only by requirement, so an offline
   * exercise screen must say "offline" rather than pretend the catalog is
   * empty. Saved routines still work offline because they carry snapshots.
   */
  readonly supportsOffline = false;

  private readonly getLanguageCode: () => string | undefined;
  /** numeric id → alpha-2 code, from `/language/`; null until first fetched. */
  private languageCodes: Map<number, string> | null = null;
  private languagePromise: Promise<Map<number, string> | null> | null = null;

  constructor(options: WgerProviderOptions) {
    this.getLanguageCode = options.getLanguageCode;
  }

  /**
   * Resolves the device language to wger's numeric ids. The mapping is fetched
   * once per process and shared: concurrent callers await the same promise, so
   * a cold start does not fire the request three times. A failure clears the
   * promise so the next call retries instead of latching onto English forever.
   */
  private async languagePreference(signal?: AbortSignal): Promise<LanguagePreference> {
    if (!this.languagePromise) {
      this.languagePromise = requestJson<WgerLanguageResponse>(BASE_URL, 'language/', {
        params: { limit: TAXONOMY_LIMIT },
        signal,
      })
        .then((response) => mapLanguageCodes(response.data.results ?? []))
        .catch((error: unknown) => {
          // A failed language lookup must not fail the exercise list.
          if (__DEV__) console.warn('[wger] language map unavailable, defaulting to en', error);
          this.languagePromise = null;
          return null;
        });
    }
    const codes = await this.languagePromise;
    if (codes) this.languageCodes = codes;
    const ids = codes ? languageIdsFor(this.getLanguageCode(), codes) : [WGER_ENGLISH_ID];
    return { ids };
  }

  /**
   * Value for `language__code`, e.g. "fr,en". Sending the fallback alongside the
   * user's language is what keeps a partially-translated catalog from looking
   * broken: `language__code=fr` alone hides two thirds of the exercises.
   */
  private languageCodeParam(preference: LanguagePreference): string {
    const codes = preference.ids
      .map((id) => this.languageCodes?.get(id))
      .filter((value): value is string => Boolean(value));
    return codes.length > 0 ? codes.join(',') : 'en';
  }

  private async fetchPage(
    offset: number,
    filters: Record<string, string | number>,
    signal: AbortSignal | undefined,
    preference: LanguagePreference,
  ): Promise<ExercisePage> {
    const response = await requestJson<WgerListResponse<WgerExerciseInfo>>(
      BASE_URL,
      'exerciseinfo/',
      { params: { limit: PAGE_SIZE, offset, ...filters }, signal },
    );
    const rows = response.data.results ?? [];
    const fetched = offset + rows.length;
    const total = response.total;
    // Trust the row count over `next`: the server echoes an absolute URL, and an
    // empty page is the real end of the list whatever `next` claims.
    const hasMore = rows.length > 0 && (total === null || fetched < total);

    return {
      items: rows.map((row) => mapExerciseInfo(row, { preference })),
      nextCursor: hasMore ? String(fetched) : null,
      total,
    };
  }

  async page(
    filter: ExerciseFilter,
    cursor: string | null,
    signal?: AbortSignal,
  ): Promise<ExercisePage> {
    const preference = await this.languagePreference(signal);
    const query = filter.query.trim();
    return this.fetchPage(
      parseCursor(cursor),
      {
        language__code: this.languageCodeParam(preference),
        // pg_trgm search, not `search`: the plain `search` param is accepted and
        // silently ignored, which returns all 903 exercises and looks like a bug
        // in our filtering.
        ...(query ? { name__search: query } : {}),
        ...(filter.categoryId ? { category: filter.categoryId } : {}),
        ...(filter.equipmentId ? { equipment: filter.equipmentId } : {}),
        ...(filter.muscleId ? { muscles: filter.muscleId } : {}),
      },
      signal,
      preference,
    );
  }

  async byId(externalId: number, signal?: AbortSignal): Promise<Exercise | null> {
    const preference = await this.languagePreference(signal);
    try {
      const response = await requestJson<WgerExerciseInfo>(BASE_URL, `exerciseinfo/${externalId}/`, {
        params: { language__code: this.languageCodeParam(preference) },
        signal,
      });
      return mapExerciseInfo(response.data, { preference });
    } catch (error) {
      // "No such exercise" is an answer, not a failure: the caller shows a
      // not-found state instead of an error screen.
      if (error instanceof ApiError && error.kind === 'not-found') return null;
      throw error;
    }
  }

  /**
   * Categories, equipment and muscles. Three tiny requests in parallel: the
   * API has no combined taxonomy endpoint, and `Promise.all` means one round
   * trip's latency, not three.
   */
  async taxonomy(signal?: AbortSignal): Promise<ExerciseTaxonomy> {
    const [categories, equipment, muscles] = await Promise.all([
      requestJson<WgerTaxonomyResponse>(BASE_URL, 'exercisecategory/', {
        params: { limit: TAXONOMY_LIMIT },
        signal,
      }),
      requestJson<WgerTaxonomyResponse>(BASE_URL, 'equipment/', {
        params: { limit: TAXONOMY_LIMIT },
        signal,
      }),
      requestJson<WgerMuscleResponse>(BASE_URL, 'muscle/', {
        params: { limit: TAXONOMY_LIMIT },
        signal,
      }),
    ]);
    return {
      categories: (categories.data.results ?? []).map(mapTaxon),
      equipment: (equipment.data.results ?? []).map(mapTaxon),
      muscles: (muscles.data.results ?? []).map(mapMuscleTaxon),
    };
  }

  /**
   * Variation family (e.g. the grip variants of a bench press). wger filters
   * variations by group *uuid*, and the uuid lives on the exercise row, so this
   * costs a detail fetch first. Returns [] for exercises with no variations,
   * and never includes the exercise itself.
   */
  async variations(externalId: number, signal?: AbortSignal): Promise<Exercise[]> {
    const preference = await this.languagePreference(signal);
    const language = this.languageCodeParam(preference);
    const detail = await requestJson<WgerExerciseInfo>(BASE_URL, `exerciseinfo/${externalId}/`, {
      params: { language__code: language },
      signal,
    });
    const group = detail.data.variation_group;
    if (!group) return [];

    const response = await requestJson<WgerListResponse<WgerExerciseInfo>>(
      BASE_URL,
      'exerciseinfo/',
      { params: { variation_group: group, limit: 50, language__code: language }, signal },
    );
    return (response.data.results ?? [])
      .filter((row) => row.id !== externalId)
      .map((row) => mapExerciseInfo(row, { preference }));
  }
}

export function createWgerProvider(options: WgerProviderOptions): WgerExerciseProvider {
  return new WgerExerciseProvider(options);
}
