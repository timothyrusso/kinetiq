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
 * "bench" can overwrite the results for "bench press" — the stale overwrite the
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
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { getExerciseProvider } from '@/api';
import { FIRST_PAGE, emptyFilter, emptyTaxonomy } from '@/api/types';
import type { Exercise, ExerciseFilter } from '@/domain/types';
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

export function useExerciseSearch(filter: ExerciseFilter) {
  const provider = getExerciseProvider();

  const query = useInfiniteQuery<
    ExercisePageData,
    Error,
    ExerciseSearchResult,
    QueryKey,
    PageParams
  >({
    queryKey: queryKeys.exercises.list(filter),
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
    staleTime: 5 * 60_000,
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
 * failure must never block searching — filters are optional, so the UI hides them
 * rather than erroring.
 */
export function useExerciseTaxonomy() {
  const provider = getExerciseProvider();
  return useQuery({
    queryKey: queryKeys.exercises.taxonomy(),
    queryFn: ({ signal }) => provider.taxonomy(signal),
    // A module constant rather than `emptyTaxonomy`: passing the factory itself
    // makes TypeScript infer the data type as the factory's *return type of a
    // function*, and a fresh object per render would break memoised filter rows.
    placeholderData: EMPTY_TAXONOMY,
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 60 * 60_000,
  });
}

/**
 * Detail for a remote exercise.
 *
 * `initialData` lets the row the user tapped — which already carries a complete
 * `Exercise` from the list response — render instantly while the fetch confirms it.
 * wger's list rows are complete (verified against live payloads), so this is
 * normally a cheap confirmation; the five-minute stale time means revisiting a
 * detail screen does not repeat it. A 404 returns what we already had: the honest
 * answer, and nothing invented.
 */
export function useExerciseDetail(exercise: Exercise | null) {
  const provider = getExerciseProvider();
  const externalId = exercise?.externalId ?? null;
  return useQuery({
    queryKey: queryKeys.exercises.detail(exercise?.id ?? 'none'),
    queryFn: async ({ signal }) => {
      if (externalId === null) return exercise;
      return (await provider.byId(externalId, signal)) ?? exercise;
    },
    enabled: exercise !== null && externalId !== null,
    initialData: exercise !== null && externalId !== null ? exercise : undefined,
    staleTime: 5 * 60_000,
  });
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

/** Warms taxonomy before the filter sheet that needs it opens; safe to repeat. */
export function prefetchExerciseTaxonomy(client: QueryClient): void {
  void client.prefetchQuery({
    queryKey: queryKeys.exercises.taxonomy(),
    queryFn: ({ signal }) => getExerciseProvider().taxonomy(signal),
    staleTime: 24 * 60 * 60_000,
  });
}

/** The filter an unfiltered browse uses; also the reset target. */
export const BROWSE_FILTER: ExerciseFilter = emptyFilter();
