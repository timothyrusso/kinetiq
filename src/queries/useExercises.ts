/**
 * Exercise browsing over the local catalog.
 *
 * Every read here is answered from SQLite by the local provider, so nothing waits on the
 * network and nothing goes stale on a timer: the catalog changes only when `replaceCatalog`
 * swaps it, and that swap invalidates `queryKeys.exercises.all`. Hence `staleTime: Infinity`
 * throughout, with a modest `gcTime` so filters nobody returns to do not pile up in memory.
 *
 * **Cancellation.** Every page still gets the `signal` TanStack hands the query function, and
 * TanStack discards a result whose key has moved on, so a slow answer for "bench" can never
 * overwrite the results for "bench press".
 *
 * **Duplicate rows.** Offset pagination can repeat a row across pages if the catalog is swapped
 * while the user is scrolling. `dedupe` folds every page through one id-keyed pass at read time,
 * so a row that appears on pages 2 and 3 is rendered once and keeps its first position.
 *
 * **Language.** The render language is part of every list, detail and variations key, so an
 * in-app language switch reads the catalog again instead of showing the cached names.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { getExerciseProvider } from '@/api';
import type { CatalogLanguage } from '@/catalog/types';
import { FIRST_PAGE, emptyTaxonomy } from '@/api/types';
import type { Exercise, ExerciseFilter, ExerciseSnapshot } from '@/domain/types';
import { externalIdOf, isLocalExerciseId } from '@/domain/exerciseId';
import { resolveLanguage } from '@/i18n';
import { snapshotById } from '@/persistence';
import { queryKeys } from '@/query/keys';
import { useSettings } from '@/settings';

const FIRST_OFFSET = 0;

/** Stable identity so filter chips reading `taxonomy.categories` do not re-render. */
const EMPTY_TAXONOMY = emptyTaxonomy();

/** One page as fetched. Flat and small so `select` and dev tooling stay legible. */
export type ExercisePageData = {
  items: Exercise[];
  /** Offset the next page should request; null when exhausted. */
  nextOffset: number | null;
  total: number | null;
};

type PageParams = { offset: number };

export type ExerciseSearchResult = {
  items: Exercise[];
  total: number | null;
  hasMore: boolean;
};

/** Id-keyed fold across pages; first occurrence wins, order preserved. */
function dedupe(pages: readonly ExercisePageData[]): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function selectPages(data: {
  pages: readonly ExercisePageData[];
}): ExerciseSearchResult {
  const items = dedupe(data.pages);
  const last = data.pages[data.pages.length - 1];
  const total = last?.total ?? null;
  // Trust the row count over the server's `next` URL in both directions: a total
  // we have already reached ends the list even if `next` is non-null, and an
  // unread `next` with a total we have not reached keeps going.
  const reachedTotal = total !== null && items.length >= total;
  return {
    items,
    total,
    hasMore: last?.nextOffset != null && !reachedTotal,
  };
}

/**
 * How long an unused exercise query stays in memory. Re-reading SQLite is cheap, so this only
 * bounds memory: a picker session's filters survive, last week's do not.
 */
const EXERCISE_GC_MS = 10 * 60_000;

/** The language exercise rows render in, from the same setting `useT` reads. */
function useCatalogLanguage(): CatalogLanguage {
  return resolveLanguage(useSettings((s) => s.language));
}

/**
 * @param active whether the screen that owns this query is on screen. Fetching is gated on it.
 *
 * The gate keeps a tab that is never opened from costing anything. `NativeTabs` renders a real
 * UITabBarController, and every tab's screen is MOUNTED when the bar is created: there is no
 * `lazy` option, because the platform does not have one. The reads are local, but a closed
 * picker still has no reason to query the catalog during launch.
 */
export function useExerciseSearch(filter: ExerciseFilter, active = true) {
  const provider = getExerciseProvider();
  const language = useCatalogLanguage();

  const query = useInfiniteQuery<
    ExercisePageData,
    Error,
    ExerciseSearchResult,
    QueryKey,
    PageParams
  >({
    queryKey: queryKeys.exercises.list(filter, language),
    enabled: active,
    initialPageParam: { offset: FIRST_OFFSET } as PageParams,
    queryFn: async ({ pageParam, signal }) => {
      const offset = pageParam?.offset ?? FIRST_OFFSET;
      const page = await provider.page(
        filter,
        // null is the port's "start here"; every later page is an explicit offset.
        offset === FIRST_OFFSET ? FIRST_PAGE : String(offset),
        signal,
      );
      const parsed = Number(page.nextCursor ?? Number.NaN);
      const nextOffset = Number.isFinite(parsed)
        ? parsed
        : offset + Math.max(1, page.items.length);
      return {
        items: page.items,
        nextOffset: page.nextCursor === null || page.items.length === 0 ? null : nextOffset,
        total: page.total,
      } satisfies ExercisePageData;
    },
    getNextPageParam: (lastPage) =>
      lastPage.nextOffset === null ? undefined : { offset: lastPage.nextOffset },
    select: selectPages,
    // While a new search is in flight, keep the previous rows on screen rather than
    // flashing a skeleton: even a local read can take a frame or two, and a skeleton in
    // that window reads as a stutter. Distinguishing "placeholder" from
    // "fresh" is left to `isPlaceholder` so the UI can dim instead of lie.
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });

  const loadNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    // `hasNextPage`/`isFetchingNextPage` are primitives read at call time from the
    // closure, so the identity only needs to change when they do.
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? null,
    hasMore: query.data?.hasMore ?? false,
    loadNextPage,
    isLoading: query.isLoading,
    /** True while the *previous* filter's rows are still on screen. */
    isPlaceholder: query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    error: query.error,
    refresh: query.refetch,
  };
}

/**
 * Taxonomy is 8 + 12 + 15 rows and changes only with the catalog. A failure must never
 * block searching: filters are optional, so the UI hides them rather than erroring.
 */
/** @param active see `useExerciseSearch`: the same mount-is-not-focus problem. */
export function useExerciseTaxonomy(active = true) {
  const provider = getExerciseProvider();
  return useQuery({
    queryKey: queryKeys.exercises.taxonomy(),
    enabled: active,
    queryFn: ({ signal }) => provider.taxonomy(signal),
    // A module constant rather than `emptyTaxonomy`: passing the factory itself
    // makes TypeScript infer the data type as the factory's *return type of a
    // function*, and a fresh object per render would break memoised filter rows.
    placeholderData: EMPTY_TAXONOMY,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });
}

/* ---------------------------------------------------------------- detail -- */

/**
 * The one question the exercise detail screen asks: what do we know about `id`?
 *
 * ## Two sources, and the screen says which one it used
 *
 * - The **catalog** row, from the local copy of the exercise library. It is the complete
 *   answer, including the field only the catalog carries (`videoUrl`).
 * - A **stored snapshot** exists for everything the user ever added to a routine or trained.
 *   It stands in when the catalog has no row for the id: an exercise wger has since retired,
 *   or a `local:` exercise that never came from the catalog. Less art, no video, and still a
 *   complete screen.
 *
 * Precedence is catalog, then snapshot, and `from` names whichever is on screen so the copy
 * can be true about its own provenance. Nothing here fills a gap in: a snapshot has no video,
 * so the media section is absent rather than a dead link.
 */
type ExerciseDetailSource = 'catalog' | 'stored' | 'none';

type ExerciseDetailState = {
  /** The best row we have. Null means we know nothing about this id. */
  exercise: Exercise | null;
  /** Where `exercise` came from; `'none'` exactly when it is null. */
  from: ExerciseDetailSource;
  /** Whether this id can be in the catalog at all: false for `local:` ids. */
  fetchable: boolean;
  /** True only while there is *nothing* to show. With content up, use `isFetching`. */
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  /** The stored row, so the screen can date its own copy. */
  stored: ExerciseSnapshot | null;
  retry: () => void;
};

/**
 * A snapshot as an `Exercise`.
 *
 * The two types differ by exactly one field, and the way that difference is honoured is
 * the point: a snapshot never carries a video URL, because storing one was never
 * necessary to render a routine. `null` here means "we have no video for this", which is
 * true, and the UI omits the section. Inventing a URL to fill the shape would be the one
 * thing in this file a user could catch us doing.
 */
function exerciseFromSnapshot(snapshot: ExerciseSnapshot): Exercise {
  return {
    id: snapshot.exerciseId,
    name: snapshot.name,
    instructions: snapshot.instructions,
    category: snapshot.category,
    primaryMuscles: snapshot.primaryMuscles,
    secondaryMuscles: snapshot.secondaryMuscles,
    equipment: snapshot.equipment,
    imageUrl: snapshot.imageUrl,
    thumbnailUrl: snapshot.thumbnailUrl,
    videoUrl: null,
    source: snapshot.externalId === null ? 'local' : 'remote',
    externalId: snapshot.externalId,
  };
}

export function useExerciseResolution(id: string | null): ExerciseDetailState {
  const provider = getExerciseProvider();
  const language = useCatalogLanguage();
  const externalId = id === null || isLocalExerciseId(id) ? null : externalIdOf(id);
  const fetchable = externalId !== null;

  // No `staleTime`: a single indexed row, and being wrong about an exercise the user added to
  // a routine two seconds ago costs more than re-reading it on every open.
  const stored = useQuery({
    queryKey: [...queryKeys.exercises.all, 'stored', id ?? 'none'] as const,
    queryFn: () => (id === null ? Promise.resolve(null) : snapshotById(id)),
    enabled: id !== null,
  });

  const catalog = useQuery({
    queryKey: queryKeys.exercises.detail(id ?? 'none', language),
    queryFn: () => (externalId === null ? Promise.resolve(null) : provider.byId(externalId)),
    enabled: fetchable,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });

  const snapshot = stored.data ?? null;
  const fromCatalog = catalog.data ?? null;
  const exercise = fromCatalog ?? (snapshot === null ? null : exerciseFromSnapshot(snapshot));

  let from: ExerciseDetailSource = 'none';
  if (fromCatalog !== null) from = 'catalog';
  else if (snapshot !== null) from = 'stored';

  return {
    exercise,
    from,
    fetchable,
    // `id !== null` first: with no id both queries are disabled, and a disabled query with no
    // data stays pending forever, which held the screen on its skeleton for good.
    isLoading:
      id !== null &&
      exercise === null &&
      (stored.isPending || stored.isFetching || (fetchable && catalog.isPending)),
    isFetching: catalog.isFetching,
    error: exercise === null ? (catalog.error ?? stored.error) : null,
    stored: snapshot,
    retry: () => {
      void stored.refetch();
      if (fetchable) void catalog.refetch();
    },
  };
}

/** Other exercises in the same variation group. */
export function useExerciseVariations(exercise: Exercise | null) {
  const provider = getExerciseProvider();
  const language = useCatalogLanguage();
  const externalId = exercise?.externalId ?? null;
  return useQuery({
    queryKey: queryKeys.exercises.variations(exercise?.id ?? 'none', language),
    queryFn: () => provider.variations(externalId ?? 0),
    enabled: exercise !== null && externalId !== null,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });
}
