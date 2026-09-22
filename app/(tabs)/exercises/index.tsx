/**
 * Exercises tab: browse, search and filter the remote catalog.
 *
 * ## What this screen promises the network
 *
 * The catalog is wger's, over a wide area. Everything below exists because of that:
 *
 * - **The query key is the debounced filter.** Typing "romanian" produces one request, not
 *   eight, because the *value* settles before the key changes (see `exerciseFilters.ts`)
 *   and TanStack owns the request the settled key triggers.
 * - **Pages are de-duplicated at read time**, so a row repeated across a shifting offset
 *   window renders exactly once and keeps its first position.
 * - **Results are never cleared to make room for new ones.** `keepPreviousData` holds the
 *   old rows while a new search is in flight and `ExerciseRow` dims them; swapping in a
 *   skeleton on every keystroke would flash six times per search.
 * - **Reaching the end is a fact, not a guess.** `hasNextPage` drives both the footer and
 *   `onEndReached`, so there is no "load more" button that can be double-tapped into a loop.
 *
 * ## The server's total is the only count shown
 *
 * The header says "N exercises" from the provider's `total`, because a filtered catalog that
 * says nothing about how many it found leaves the user guessing whether the filter worked.
 * When `total` is absent: the port allows it: no count is shown rather than one estimated
 * from loaded pages, which would be a number that changes as you scroll.
 *
 * ## A row tap must not wait on a fetch
 *
 * Tapping pushes a detail screen that renders from the row's own `Exercise` immediately and
 * revalidates in the background. A tap that waited on the network to show a name the user
 * just read would feel broken, not careful.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import type { ExerciseFilter } from '@/domain/types';
import { StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused, useRouter } from 'expo-router';

import { useTabContentBottom } from '@/ui/insets';

import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { MetaLine } from '@/ui/display';
import { HeaderSearchBar, HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { ExerciseRow } from '@/ui/rows';
import { Badge, Row } from '@/ui/layout';
import { Chip } from '@/ui/controls/Chip';
import { Txt } from '@/ui/Text';
import { Button } from '@/ui/controls/Button';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useExerciseSearch, useExerciseTaxonomy } from '@/queries/useExercises';
import {
  activeFilterCount,
  resetExerciseFilter,
  setExerciseCategoryId,
  setExerciseEquipmentId,
  setExerciseMuscleId,
  setExerciseQuery,
  useExerciseFilter,
  useIsQuerySettling,
} from '@/queries/exerciseFilters';
import type { Exercise, Taxon } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { useT } from '@/i18n/useT';
import { spacing, screenGutter } from '@/theme/tokens';
import { joinMiddleDot } from '@/utils/format';


export default function ExercisesScreen() {
  const { t } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();

  const { filter } = useExerciseFilter();
  const settling = useIsQuerySettling();
  // Mounted is not the same as on screen. `NativeTabs` is a real UITabBarController and mounts
  // every tab's screen when the bar is built, so without this gate the catalog was fetched
  // during app launch for a tab the user may never open: measured at five wger requests before
  // the first interaction. Focus is the condition that actually means "someone is looking at
  // this", and it also parks the query while the user is elsewhere.
  const focused = useIsFocused();
  const taxonomy = useExerciseTaxonomy(focused);
  const search = useExerciseSearch(filter, focused);

  const activeCount = activeFilterCount(filter);
  const searching = filter.query.length > 0;

  const activeChips = useMemo(
    () =>
      [
        { key: 'category', name: nameOf(taxonomy.data?.categories, filter.categoryId), clear: () => setExerciseCategoryId(null) },
        { key: 'muscle', name: nameOf(taxonomy.data?.muscles, filter.muscleId), clear: () => setExerciseMuscleId(null) },
        { key: 'equipment', name: nameOf(taxonomy.data?.equipment, filter.equipmentId), clear: () => setExerciseEquipmentId(null) },
      ].filter((chip): chip is { key: string; name: string; clear: () => void } => chip.name !== null),
    [filter.categoryId, filter.equipmentId, filter.muscleId, taxonomy.data],
  );

  const openExercise = useCallback(
    (id: string) => router.push(routes.exerciseDetail(id)),
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Exercise; index: number }) => (
      <ExerciseRow
        name={item.name}
        uri={item.thumbnailUrl ?? item.imageUrl}
        subtitle={exerciseSubtitle(item)}
        theme={theme}
        // Rows on screen during a refetch belong to the *previous* query. Dimming them
        // rather than hiding them is the difference between "it's thinking" and "it broke".
        dimmed={search.isPlaceholder}
        topDivider={index > 0}
        onPress={() => openExercise(item.id)}
      />
    ),
    [openExercise, search.isPlaceholder, theme],
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // Depend on the primitives, not on `search`: the hook returns a fresh result object every
  // render, so `[search]` re-created this callback on every keystroke, scroll position and
  // focus change: and FlashList re-binds `onEndReached` each time its identity moves. The
  // guards below still read current values, because the closure is rebuilt whenever one flips.
  const { hasMore, isFetchingNextPage, loadNextPage } = search;

  /**
   * Page when the user scrolls, never at layout.
   *
   * `onEndReached` fires during the FIRST layout, before the list has measured its rows, so
   * "within 40% of the end" is trivially true of a content height that is still zero. Each
   * page that lands re-triggers it, and the list walks the WHOLE result set without anyone
   * touching the screen: measured at 8 requests, 200 rows, for a search showing eight of
   * them. FlashList 2 dropped `estimatedItemSize`, so there is no size hint to fix it with.
   *
   * A scroll is the honest signal that the user wants more. One page is 25 rows, which
   * overflows any phone screen, so nothing is lost by refusing to prefetch page 2 before the
   * first scroll. The latch reopens per search, because a new term puts the list back at the
   * top with a new result set behind it.
   */
  /**
   * A committed search returns the list to the top.
   *
   * FlashList keeps its offset across a data change, so typing a new term left the user
   * hundreds of points down a result set they had never seen: the first rows of the answer
   * were above the fold, which reads as "the search did nothing". It also defeated the paging
   * gate below, because an offset inherited from the previous term looks exactly like a user
   * who has scrolled and wants more.
   */
  const listRef = useRef<FlashListRef<Exercise>>(null);
  const lastScroll = useRef<{ y: number; filter: ExerciseFilter | null }>({ y: 0, filter: null });
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // The recorded scroll belongs to the term that produced it, so it is cleared with the
    // list rather than left to look like intent on a result set the user has not seen.
    lastScroll.current = { y: 0, filter };
  }, [filter]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Record the filter the scroll belonged to, not just that one happened. A boolean latch
      // reset in an effect loses a race the full suite found and a single run did not: the
      // effect runs on the render AFTER the filter changes, and `onEndReached` fires inside
      // that gap, so a list left scrolled by an earlier screen paged the new search anyway.
      // Storing the pair makes the question unambiguous and needs no effect at all.
      lastScroll.current = { y: event.nativeEvent.contentOffset.y, filter };
    },
    [filter],
  );

  // The search lives in the native header. The bar keeps its own text, so the one thing this
  // screen must do by hand is empty it when the filter is reset from elsewhere (the Clear
  // button, a removed chip that was the query), or the bar and the list would disagree.
  const searchRef = useRef<SearchBarCommands>(null);
  const onSearchText = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => setExerciseQuery(event.nativeEvent.text),
    [],
  );
  const clearSearch = useCallback(() => setExerciseQuery(''), []);
  const resetAll = useCallback(() => {
    searchRef.current?.clearText();
    resetExerciseFilter();
  }, []);
  const openFilters = useCallback(() => router.push(routes.exerciseFilters()), [router]);

  const onEndReached = useCallback(() => {
    const seen = lastScroll.current;
    // Page only for a scroll the user made ON THIS result set.
    if (seen.filter !== filter || seen.y <= 8) return;
    if (hasMore && !isFetchingNextPage) loadNextPage();
  }, [filter, hasMore, isFetchingNextPage, loadNextPage]);

  const listHeader = (
    <>
      <View style={styles.controls}>
        <MetaLine
          items={[
            {
              icon: settling ? 'refresh' : 'library',
              label: settling
                ? t('exerciseList.searching')
                : search.total === null
                  ? t('exerciseList.subtitle')
                  : searching
                    ? t('exercises.countFor', { count: search.total, query: filter.query })
                    : t('exercises.count', { count: search.total }),
            },
          ]}
          theme={theme}
          wrap
        />

        <Row gap="sm" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={
                activeCount === 0
                  ? t('common.filters')
                  : t('exerciseList.filtersOn', {
                      count: activeCount,
                      word: t('exerciseList.filterWord', { count: activeCount }),
                    })
              }
              icon="filter"
              size="sm"
              selected={activeCount > 0}
              onPress={openFilters}
            />
          </View>
          {activeCount > 0 ? (
            <Button
              label={t('common.clear')}
              size="sm"
              variant="quiet"
              onPress={resetAll}
            />
          ) : null}
        </Row>

        {/* One chip per active filter, each removable on its own. A single "Filtered" pill
            would make narrowing down a two-step affair: open the sheet, find the field. */}
        {activeChips.length > 0 ? (
          <View style={styles.chips}>
            {activeChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.name}
                size="sm"
                selected
                onPress={chip.clear}
                onRemove={chip.clear}
              />
            ))}
          </View>
        ) : null}

        <FetchNotice searching={search.isRefetching && !search.isLoading}
                     failed={search.error !== null && search.items.length > 0}
                     onRetry={() => void search.refresh()} />
      </View>
    </>
  );

  return (
    <>
      <ScreenHeader title={t('exercises.title')} />
      <HeaderSearchBar
        ref={searchRef}
        placeholder={t('exercises.searchLabel')}
        onChangeText={onSearchText}
        onCancelButtonPress={clearSearch}
        autoCapitalize="none"
        hideWhenScrolling={false}
      />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'filter', onPress: openFilters, t, label: 'common.filters' })}
      </HeaderToolbar>

      <FlashList
        {...SCROLL_INSETS}
        ref={listRef}
        data={search.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        refreshControl={
          <ThemedRefreshControl
            refreshing={search.isRefetching && search.items.length > 0}
            onRefresh={() => void search.refresh()}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          search.isLoading || search.error !== null ? null : (
            <ListFooter
              loading={search.isFetchingNextPage}
              hasMore={search.hasMore}
              count={search.items.length}
              total={search.total}
            />
          )
        }
        ListEmptyComponent={
          search.isLoading ? (
            <View style={{ paddingHorizontal: screenGutter }}>
              <SkeletonList rows={7} />
            </View>
          ) : search.error !== null ? (
            // `ErrorState` already distinguishes offline from a server fault: different
            // icon, different copy: so this screen only supplies the subject line. The
            // offline copy it uses is the promise this app makes: saved routines survive.
            <ErrorState
              error={search.error}
              title={t('exercises.unavailable')}
              onRetry={() => void search.refresh()}
            />
          ) : searching || activeCount > 0 ? (
            <EmptyState
              title={t('exerciseList.noMatchTitle')}
              message={t('exerciseList.noMatchMessage')}
              icon="search"
              actionLabel={t('exerciseList.clearSearch')}
              onAction={resetExerciseFilter}
            />
          ) : (
            <EmptyState
              title={t('exerciseList.nothingLoadedTitle')}
              message={t('exerciseList.nothingLoadedMessage')}
              icon="library"
              actionLabel={t('common.retry')}
              onAction={() => void search.refresh()}
            />
          )
        }
        style={{ backgroundColor: theme.colors.background }}
      />

    </>
  );
}

/**
 * Refetch status, which `keepPreviousData` makes invisible by design.
 *
 * Keeping the old rows visible while a new query runs is the right trade for a search field,
 * but it leaves two states with no on-screen evidence: a refetch in flight, and a refetch that
 * failed while readable rows stay on screen. The second one is the dangerous pair: the user
 * has no reason to suspect the list they are looking at is not the answer to the filter they
 * just set: so it gets a warning tone and its own retry, not just a badge.
 */
function FetchNotice({
  searching,
  failed,
  onRetry,
}: {
  searching: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useT();
  if (failed) {
    return (
      <Row gap="md" align="center" justify="between">
        <View style={{ flex: 1, minWidth: 0 }}>
          <Badge label={t('exercises.outdated')} tone="warning" />
          {/* The badge alone is not an explanation. Sighted or not, "OUTDATED RESULTS" next to a
              list does not say that the newest search failed and these rows answer the PREVIOUS
              one: and this is the branch where knowing that matters most. The sibling
              "Updating" branch below says so in a sentence; this one used to leave the amber to
              carry it, which also meant the state was communicated by colour alone. */}
          <Txt variant="micro" tone="faint">
            {t('exercises.outdatedDetail')}
          </Txt>
        </View>
        <Button label={t('common.retry')} size="sm" variant="secondary" onPress={onRetry} />
      </Row>
    );
  }
  if (!searching) return null;
  return (
    <Row gap="sm" align="center">
      <Badge label={t('exercises.updating')} tone="info" />
      <Txt variant="micro" tone="faint">
        {t('exercises.updatingDetail')}
      </Txt>
    </Row>
  );
}

function ListFooter({
  loading,
  hasMore,
  count,
  total,
}: {
  loading: boolean;
  hasMore: boolean;
  count: number;
  total: number | null;
}) {
  const { t } = useT();
  return (
    <View style={styles.footer}>
      <Txt variant="caption" tone="faint" align="center">
        {loading
          ? t('exerciseList.loadingMore')
          : hasMore
            ? t('exerciseList.countLoaded', { shown: count.toLocaleString() })
            : total === null
              ? t('exerciseList.countShown', { shown: count.toLocaleString() })
              : t('exerciseList.allLoaded', {
                  shown: total.toLocaleString(),
                  word: t('exerciseList.exerciseWord', { count: total }),
                })}
      </Txt>
    </View>
  );
}

/**
 * What a catalog row says under its name.
 *
 * Muscles first when present, because that is the discriminator between two similarly named
 * exercises ("Row" barbell vs. cable); category as the fallback, because wger fills it more
 * often than it fills equipment. Everything optional is optional *silently*.
 */
function exerciseSubtitle(exercise: Exercise): string {
  const shown = exercise.primaryMuscles.slice(0, 2);
  const muscles = shown.join(', ');
  // Drop the category when a muscle already said it. wger's taxonomies overlap, "Arnold
  // Shoulder Press" is category Shoulders with primary muscle Shoulders: and the naive join
  // rendered "Shoulders · Shoulders", which reads as a duplication bug rather than as two
  // facts that happen to coincide. Compared case-insensitively because the two taxonomies are
  // maintained separately and are not guaranteed to agree on capitalisation.
  const category = exercise.category ?? null;
  const redundant =
    category !== null && shown.some((m) => m.toLowerCase() === category.toLowerCase());
  return joinMiddleDot([muscles.length > 0 ? muscles : null, redundant ? null : category]);
}

function nameOf(taxons: readonly Taxon[] | undefined, id: number | null): string | null {
  if (id === null || taxons === undefined) return null;
  return taxons.find((taxon) => taxon.id === id)?.name ?? null;
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { paddingVertical: spacing.xl, paddingHorizontal: screenGutter },
});
