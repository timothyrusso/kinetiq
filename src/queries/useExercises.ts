/**
 * Exercise browsing over the remote provider.
 *
 * The two failure modes the brief names by name both live in this file.
 *
 * **Cancellation.** Every page gets the `signal` TanStack hands the query
 * function. When the user types another character the query key changes, the old
 * observer unsubscribes, and its in-flight request is aborted instead of being left
 * to land. That matters doubly here because wger's `name__search` is pg_trgm fuzzy
 * matching: short queries are fast, longer ones scan more trigrams, so late
 * responses really do arrive out of order. Without the signal, a slow answer for
 * "bench" can overwrite the results for "bench press": the stale overwrite the
 * brief forbids. TanStack *also* discards a result whose key no longer matches, so
 * the two guards overlap deliberately: one stops the wasted work, the other stops
 * the wrong render.
 *
 * **Duplicate rows.** Offset pagination over a server we do not control can repeat
 * a row across pages: wger orders by id ascending, but a filter applied while the
 * user is still scrolling shifts the window. `dedupe` therefore folds every page
 * through one id-keyed pass at read time, so a row that appears on pages 2 and 3 is
 * rendered exactly once and keeps its first position. Offsets stay purely
 * positional (`offset + limit`), which is what makes this safe: de-duping at the
 * read boundary means it can never shift the next request and start a loop.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { getExerciseProvider } from '@/api';
import { FIRST_PAGE, emptyTaxonomy } from '@/api/types';
import type { Exercise, ExerciseFilter, ExerciseSnapshot } from '@/domain/types';
import { externalIdOf, isLocalExerciseId } from '@/domain/exerciseId';
import { snapshotById } from '@/persistence';
import { queryKeys } from '@/query/keys';

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
 * How long one page of browse results stays fresh. The list is a few hundred rows of text;
 * re-asking for it because a tab changed is invisible work, and five minutes comfortably
 * outlasts a browsing session.
 *
 * Named rather than inlined because the detail query below also waits five minutes and means
 * something *different* by it: a single exercise is unlikely to change, not "a tab switch is
 * cheap". Two identical literals with two different justifications invite someone to
 * "deduplicate" them into one constant that is quietly wrong about both.
 */
const EXERCISE_LIST_STALE_MS = 5 * 60_000;

/**
 * Taxonomy changes on the order of months, and two callers ask for it: the hook and the
 * pre-warm that runs before the filter sheet opens. They must agree or the pre-warm warms
 * something that is already cold by the time the sheet reads it, which is the entire failure
 * mode of a speculative fetch.
 */
const TAXONOMY_STALE_MS = 24 * 60 * 60_000;

/**
 * @param active whether the screen that owns this query is on screen. Fetching is gated on it.
 *
 * The gate is not an optimisation, it is the difference between a tab that costs nothing until
 * it is opened and one that fetches the whole wger catalog during app launch. `NativeTabs`
 * renders a real UITabBarController, and every tab's screen is MOUNTED when the bar is created
 *: there is no `lazy` option, because the platform does not have one. Measured after that
 * switch: a cold launch sent five wger requests before the user had touched anything, for a
 * tab they might never open.
 */
export function useExerciseSearch(filter: ExerciseFilter, active = true) {
  const provider = getExerciseProvider();

  const query = useInfiniteQuery<
    ExercisePageData,
    Error,
    ExerciseSearchResult,
    QueryKey,
    PageParams
  >({
    queryKey: queryKeys.exercises.list(filter),
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
    // flashing a skeleton: with fuzzy matching the gap is a few hundred ms, and a
    // skeleton in that window reads as a stutter. Distinguishing "placeholder" from
    // "fresh" is left to `isPlaceholder` so the UI can dim instead of lie.
    placeholderData: keepPreviousData,
    staleTime: EXERCISE_LIST_STALE_MS,
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
 * Taxonomy is 8 + 12 + 15 rows and effectively static, so it gets the longest stale
 * time in the app and is prefetched as soon as the exercise tab is first focused. A
 * failure must never block searching: filters are optional, so the UI hides them
 * rather than erroring.
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
    staleTime: TAXONOMY_STALE_MS,
    gcTime: 7 * 60 * 60_000,
  });
}

/* ---------------------------------------------------------------- detail -- */

/**
 * The one question the exercise detail screen asks: what do we know about `id`?
 *
 * ## Three sources, and the screen says which one it used
 *
 * An id reaches this screen from four places: a search row, a routine item, a set in
 * the activity history, a deep link: and where it came from decides what the app is
 * able to say about it.
 *
 * - A **stored snapshot** exists for everything the user ever added to a routine (and
 *   in the history), so those open with the network off. It is also what paints on
 *   frame one while the network confirms it.
 * - A **cached list row** is the exercise as the search response returned it, including
 *   the field only the response carries (`videoUrl`). Reading it from the cache instead
 *   of refetching is what stops a list→detail→back→detail round trip costing two
 *   requests per hop.
 * - A **fetch by id** is the only way to learn about an exercise never seen before. If
 *   it fails and a snapshot exists, the snapshot stands alone: less art, no video, and
 *   still a complete screen.
 *
 * Precedence is network → cache → store, and `from` names whichever is on screen so the
 * copy can be true about its own provenance. Nothing here fills a gap in: a snapshot has
 * no video, so the media section is absent rather than a dead link.
 */
type ExerciseDetailSource = 'stored' | 'cache' | 'remote' | 'none';

export type ExerciseDetailState = {
  /** The best row we have. Null means we know nothing about this id. */
  exercise: Exercise | null;
  /** Where `exercise` came from; `'none'` exactly when it is null. */
  from: ExerciseDetailSource;
  /** Whether this id could be fetched at all: false for `local:` ids. */
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
  const client = useQueryClient();
  const provider = getExerciseProvider();
  const localOnly = id === null || isLocalExerciseId(id);

  // No `staleTime`: this is a single indexed row out of local SQLite, so the cost of
  // re-reading it on every open is irrelevant next to the cost of being wrong about an
  // exercise the user added to a routine two seconds ago.
  const stored = useQuery({
    queryKey: [...queryKeys.exercises.all, 'stored', id ?? 'none'] as const,
    queryFn: () => (id === null ? Promise.resolve(null) : snapshotById(id)),
    enabled: id !== null,
  });

  const remote = useQuery({
    queryKey: queryKeys.exercises.detail(id ?? 'none'),
    queryFn: async ({ signal }) => {
      const externalId = id === null ? null : externalIdOf(id);
      if (externalId === null) return null;
      const cached = cachedExercise(client, id);
      if (cached !== null) return cached;
      return provider.byId(externalId, signal);
    },
    enabled: id !== null && !localOnly,
    staleTime: 5 * 60_000,
    // One retry, not the default three. With a snapshot on screen this failure is
    // decorative; without one, the user is looking at an error state with a Retry button,
    // and three silent back-offs make that button feel broken.
    retry: 1,
  });

  const cached = id === null ? null : cachedExercise(client, id);
  const snapshot = stored.data ?? null;
  const exercise =
    remote.data ?? cached ?? (snapshot === null ? null : exerciseFromSnapshot(snapshot));

  let from: ExerciseDetailSource = 'none';
  if (remote.data !== null && remote.data !== undefined) from = 'remote';
  else if (cached !== null) from = 'cache';
  else if (snapshot !== null) from = 'stored';

  return {
    exercise,
    from,
    fetchable: !localOnly,
    // `id !== null` first: with no id both queries are disabled, and a disabled query with no
    // data stays pending forever, which held the screen on its skeleton for good.
    isLoading:
      id !== null &&
      exercise === null &&
      (stored.isPending || stored.isFetching || (remote.isPending && !localOnly)),
    isFetching: remote.isFetching,
    error: exercise === null ? (remote.error ?? stored.error) : null,
    stored: snapshot,
    retry: () => {
      void stored.refetch();
      if (!localOnly) void remote.refetch();
    },
  };
}

/**
 * Pull a full `Exercise` for `id` out of whichever list query holds it.
 *
 * A scan rather than a lookup, because the filter that produced the tapped row is not
 * handed to the detail route: and putting it in the URL would make cache mechanics part
 * of the app's addressing, and break the back gesture on every filter change. The scan is
 * bounded to list queries by the `['exercises','list']` prefix, and `getQueriesData` is a
 * synchronous cache read: a few small array walks at render time, no I/O, no subscription.
 * First match wins, which is safe because the same id in two filters is the same row.
 */
function cachedExercise(client: QueryClient, id: string | null): Exercise | null {
  if (id === null) return null;
  const pages = client.getQueriesData<ExerciseSearchResult>({
    queryKey: [...queryKeys.exercises.all, 'list'],
    exact: false,
  });
  for (const [, data] of pages) {
    const hit = data?.items?.find((item) => item.id === id);
    if (hit !== undefined) return hit;
  }
  return null;
}

/** Other exercises in the same variation group. */
export function useExerciseVariations(exercise: Exercise | null) {
  const provider = getExerciseProvider();
  const externalId = exercise?.externalId ?? null;
  return useQuery({
    queryKey: queryKeys.exercises.variations(exercise?.id ?? 'none'),
    queryFn: ({ signal }) => provider.variations(externalId ?? 0, signal),
    enabled: exercise !== null && externalId !== null,
    staleTime: 60 * 60_000,
  });
}
