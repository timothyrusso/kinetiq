/**
 * Exercises tab — browse, search and filter the remote catalog.
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
 * When `total` is absent — the port allows it — no count is shown rather than one estimated
 * from loaded pages, which would be a number that changes as you scroll.
 *
 * ## A row tap must not wait on a fetch
 *
 * Tapping pushes a detail screen that renders from the row's own `Exercise` immediately and
 * revalidates in the background. A tap that waited on the network to show a name the user
 * just read would feel broken, not careful.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarAction, CollapsibleHeader, CollapsibleHero, useScreenHeaderScroll } from '@/ui/Screen';
import { ExerciseRow } from '@/ui/rows';
import { Badge, Row } from '@/ui/layout';
import { Chip } from '@/ui/controls';
import { TextField } from '@/ui/TextField';
import { Txt } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
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
import { spacing } from '@/theme/tokens';
import { joinMiddleDot, pluralWord } from '@/utils/format';

const BOTTOM_SPACE = 96;

export default function ExercisesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const header = useScreenHeaderScroll();

  const { draft, filter } = useExerciseFilter();
  const settling = useIsQuerySettling();
  const taxonomy = useExerciseTaxonomy();
  const search = useExerciseSearch(filter);
  const [filterOpen, setFilterOpen] = useState(false);

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
  // focus change — and FlashList re-binds `onEndReached` each time its identity moves. The
  // guards below still read current values, because the closure is rebuilt whenever one flips.
  const { hasMore, isFetchingNextPage, loadNextPage } = search;
  const onEndReached = useCallback(() => {
    if (hasMore && !isFetchingNextPage) loadNextPage();
  }, [hasMore, isFetchingNextPage, loadNextPage]);

  const listHeader = (
    <>
      <CollapsibleHero header={header} eyebrow="Library" title="Exercises">
        <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {search.total === null
            ? 'Search the wger catalog and add anything to a routine'
            : `${search.total.toLocaleString()} ${pluralWord(search.total, 'exercise')}${
                searching ? ` for “${filter.query}”` : ''
              }`}
        </Txt>
      </CollapsibleHero>

      <View style={styles.controls}>
        <TextField
          label="Search exercises"
          value={draft}
          onChangeText={setExerciseQuery}
          placeholder="Deadlift, lat pulldown, lunges…"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search the exercise catalog"
          {...(settling ? { hint: 'Searching…' } : {})}
        />

        <Row gap="sm" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={activeCount === 0 ? 'Filters' : `${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} on`}
              icon="filter"
              size="sm"
              selected={activeCount > 0}
              onPress={() => setFilterOpen(true)}
            />
          </View>
          {activeCount > 0 ? (
            <Button label="Clear" size="sm" variant="quiet" onPress={resetExerciseFilter} />
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
    <View style={styles.root}>
      <CollapsibleHeader
        header={header}
        title="Exercises"
        right={
          <BarAction
            icon="filter"
            label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
            onPress={() => setFilterOpen(true)}
            badge={activeCount > 0}
          />
        }
      />

      <FlashList
        data={search.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: BOTTOM_SPACE + insets.bottom }}
        progressViewOffset={insets.top + 52}
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
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonList rows={7} />
            </View>
          ) : search.error !== null ? (
            // `ErrorState` already distinguishes offline from a server fault — different
            // icon, different copy — so this screen only supplies the subject line. The
            // offline copy it uses is the promise this app makes: saved routines survive.
            <ErrorState
              error={search.error}
              title="Exercise search unavailable"
              onRetry={() => void search.refresh()}
            />
          ) : searching || activeCount > 0 ? (
            <EmptyState
              title="No exercises match"
              message="wger's search is fuzzy, so if nothing came back the spelling is probably fine and the term is just unusual. Try fewer words, or widen the filters."
              icon="search"
              actionLabel="Clear search"
              onAction={resetExerciseFilter}
            />
          ) : (
            <EmptyState
              title="Nothing loaded"
              message="The catalog answered with no exercises, which it should not. Pull to refresh, or retry below."
              icon="library"
              actionLabel="Retry"
              onAction={() => void search.refresh()}
            />
          )
        }
        style={{ backgroundColor: theme.colors.background }}
      />

      {filterOpen ? <FilterSheet onClose={() => setFilterOpen(false)} /> : null}
    </View>
  );
}

/**
 * The filter sheet.
 *
 * It owns no state of its own — every selection writes straight to the store. A sheet that
 * buffered a draft filter and had an Apply button would need a second copy of the filter and
 * a diff to know whether anything had changed. Writing through means "what you see is what
 * the list is", and the list behind the scrim updates live, which is the feedback that makes
 * a filter feel trustworthy.
 */
function FilterSheet({ onClose }: { onClose: () => void }) {
  const taxonomy = useExerciseTaxonomy();
  const { filter } = useExerciseFilter();

  return (
    <Sheet title="Filter exercises" onRequestClose={onClose}>
      <TaxonPicker
        title="Category"
        taxons={taxonomy.data?.categories ?? []}
        value={filter.categoryId}
        onChange={setExerciseCategoryId}
        loading={taxonomy.isPending}
      />
      <TaxonPicker
        title="Primary muscle"
        taxons={taxonomy.data?.muscles ?? []}
        value={filter.muscleId}
        onChange={setExerciseMuscleId}
        loading={taxonomy.isPending}
      />
      <TaxonPicker
        title="Equipment"
        taxons={taxonomy.data?.equipment ?? []}
        value={filter.equipmentId}
        onChange={setExerciseEquipmentId}
        loading={taxonomy.isPending}
      />
      {taxonomy.isError ? (
        <Txt variant="caption" tone="muted">
          The list of filters could not be loaded, so there are none to pick. Searching still
          works — filters are optional.
        </Txt>
      ) : null}
      <Button label="Show all exercises" variant="secondary" onPress={resetExerciseFilter} />
    </Sheet>
  );
}

function TaxonPicker({
  title,
  taxons,
  value,
  onChange,
  loading,
}: {
  title: string;
  taxons: readonly Taxon[];
  value: number | null;
  onChange: (next: number | null) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Txt variant="caption" tone="faint">
        Loading {title.toLowerCase()} options…
      </Txt>
    );
  }
  // An empty group is hidden rather than shown empty: "Equipment — Any" with nothing after
  // it reads as a broken fetch, when in fact the provider just has none for this install.
  if (taxons.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="label" tone="muted" uppercase tracking={0.8}>
        {title}
      </Txt>
      <View style={styles.chips}>
        <Chip label="Any" size="sm" selected={value === null} onPress={() => onChange(null)} />
        {taxons.map((taxon) => (
          <Chip
            key={taxon.id}
            label={taxon.name}
            size="sm"
            selected={value === taxon.id}
            onPress={() => onChange(taxon.id)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Refetch status, which `keepPreviousData` makes invisible by design.
 *
 * Keeping the old rows visible while a new query runs is the right trade for a search field,
 * but it leaves two states with no on-screen evidence: a refetch in flight, and a refetch that
 * failed while readable rows stay on screen. The second one is the dangerous pair — the user
 * has no reason to suspect the list they are looking at is not the answer to the filter they
 * just set — so it gets a warning tone and its own retry, not just a badge.
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
  if (failed) {
    return (
      <Row gap="md" align="center" justify="between">
        <View style={{ flex: 1, minWidth: 0 }}>
          <Badge label="Outdated results" tone="warning" />
          {/* The badge alone is not an explanation. Sighted or not, "OUTDATED RESULTS" next to a
              list does not say that the newest search failed and these rows answer the PREVIOUS
              one — and this is the branch where knowing that matters most. The sibling
              "Updating" branch below says so in a sentence; this one used to leave the amber to
              carry it, which also meant the state was communicated by colour alone. */}
          <Txt variant="micro" tone="faint">
            That search failed. Showing the results from before it.
          </Txt>
        </View>
        <Button label="Retry" size="sm" variant="secondary" onPress={onRetry} />
      </Row>
    );
  }
  if (!searching) return null;
  return (
    <Row gap="sm" align="center">
      <Badge label="Updating" tone="info" />
      <Txt variant="micro" tone="faint">
        Showing the previous search while this one runs
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
  return (
    <View style={styles.footer}>
      <Txt variant="caption" tone="faint" align="center">
        {loading
          ? 'Loading more…'
          : hasMore
            ? `${count.toLocaleString()} loaded`
            : total === null
              ? `${count.toLocaleString()} shown`
              : `All ${total.toLocaleString()} ${pluralWord(total, 'exercise')} loaded`}
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
  const muscles = exercise.primaryMuscles.slice(0, 2).join(', ');
  return joinMiddleDot([muscles.length > 0 ? muscles : null, exercise.category]);
}

function nameOf(taxons: readonly Taxon[] | undefined, id: number | null): string | null {
  if (id === null || taxons === undefined) return null;
  return taxons.find((taxon) => taxon.id === id)?.name ?? null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
});
