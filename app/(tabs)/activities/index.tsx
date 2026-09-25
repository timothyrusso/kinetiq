/**
 * Activities: the whole history, filterable and searchable.
 *
 * ## Flat list, day labels as rows
 *
 * `useActivityList` hands back both a flat array and day-grouped buckets. The flat one
 * drives the FlashList, with label rows spliced in ahead of each group. Sections would be
 * the obvious alternative and are worse here for one concrete reason: with ` FlashList`
 * sections the virtualiser cannot recycle a run row as a walk row across a boundary, and
 * these rows differ in height by kind. A flat list with two declared item types recycles
 * freely within each type.
 *
 * Sorting also shapes the labels. Sorting "longest first" and then labelling by day
 * produces headings that jump around, which reads as a bug: so anything other than
 * recency drops the day headings entirely: they would stop being an ordering and start
 * claiming to be one.
 *
 * ## Search is local and debounced
 *
 * History is in SQLite, so search is a `LIKE` inside the query rather than a filter in JS:
 * it scales past what an in-memory filter would, and it means the debounce is the only rate
 * limiter needed. The query key carries the *debounced* string: one fetch per pause rather
 * than one per keystroke: and the field shows "Searching…" while the input runs ahead of
 * the data, which is the only feedback that says a keystroke was received.
 *
 * ## Row cost
 *
 * Rows are `ActivityCard` in compact mode for the whole list: memoised, formatting its own
 * metadata in a `useMemo`, and taking the id in `onPress` and `onLongPress`, so `renderItem`
 * hands every row the same two callbacks and builds no closure or object per row. The list is
 * keyed by locale because a card's metadata is phrased with `tr()`: its memo would otherwise
 * keep the old language until the row recycled.
 *
 * ## Delete is confirm-then-remove, never optimistic
 *
 * Deleting a session removes its route blob and can invalidate a personal record. Faking it
 * in the cache and rolling back on failure would briefly assert a record that no longer
 * exists; the mutation is a single indexed delete, so a pending label on the button is
 * cheaper than the inconsistency.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useTabContentBottom } from '@/ui/insets';

import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { ActivityCard, MetaLine, SectionHeader, type MetaItem } from '@/ui/display';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { SegmentedControl } from '@/ui/controls/SegmentedControl';
import { TextInput } from '@/ui/controls/TextInput';
import { Button } from '@/ui/controls/Button';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityList, useDeleteActivity } from '@/queries/useActivities';
import type { ActivityListParams, ActivitySort } from '@/query/keys';
import { useSettings } from '@/settings/hooks';
import { useIsOnline } from '@/query/networkStatus';
import type { Activity } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { useT } from '@/i18n/useT';
import { spacing, screenGutter } from '@/theme/tokens';
import { compactNumber, daysBetween, formatDurationCompact } from '@/utils/format';
import { useDebouncedValue, useIsSettling } from '@/utils/useDebouncedValue';
import type { TKey, TVars } from '@/i18n';

/** A list row is either a session or a heading above a run of sessions. */
type RowItem =
  | { type: 'activity'; activity: Activity }
  | { type: 'label'; key: string; text: string; count: number };

const SORTS: readonly { value: ActivitySort; label: TKey }[] = [
  { value: 'recent', label: 'activities.sortRecent' },
  { value: 'duration', label: 'activities.sortLongest' },
  { value: 'volume', label: 'activities.sortHeaviest' },
];

export default function ActivitiesScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const online = useIsOnline();

  const units = useSettings((s) => s.unitSystem);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ActivitySort>('recent');
  // Segment labels are catalog keys in the table above; resolved here, memoised on `t` so a
  // new array does not rebuild the native control's segments on every unrelated re-render.
  const sortSegments = useMemo(
    () => SORTS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );

  const [pendingId, setPendingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const settling = useIsSettling(search, debouncedSearch);
  const trimmed = debouncedSearch.trim();

  // Rebuilt only when a filter changes: `useActivityList` keys on the object's contents, so
  // a fresh literal every render would be a fresh query every render.
  const params = useMemo<ActivityListParams>(
    () => ({ search: trimmed, sort, groupBy: sort === 'recent' ? 'day' : 'none' }),
    [sort, trimmed],
  );

  const list = useActivityList(params);
  const removeActivity = useDeleteActivity();
  const filtering = trimmed.length > 0;
  const pendingDelete = useMemo(
    () => (pendingId === null ? null : (list.flat.find((a) => a.id === pendingId) ?? null)),
    [list.flat, pendingId],
  );

  // The day headings are phrased here rather than taken from the query's `label`, which is
  // English ("Today", "Yesterday") and formatted in the device locale rather than the app's.
  // A group's `key` is its local midnight, which is all a heading needs.
  const rows = useMemo<RowItem[]>(() => {
    if (sort !== 'recent') {
      return list.flat.map((activity) => ({ type: 'activity', activity }) as RowItem);
    }
    const out: RowItem[] = [];
    for (const group of list.groups) {
      out.push({
        type: 'label',
        key: `g-${group.key}`,
        text: dayHeading(group.key, t, locale),
        count: group.activities.length,
      });
      for (const activity of group.activities) {
        out.push({ type: 'activity', activity } as RowItem);
      }
    }
    return out;
  }, [list.flat, list.groups, locale, sort, t]);

  const openActivity = useCallback(
    (id: string) => router.push(routes.activityDetail(id)),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.type === 'label') {
        return <SectionHeader title={item.text} counter={item.count} style={styles.dayLabel} />;
      }
      return (
        <ActivityCard
          activity={item.activity}
          theme={theme}
          units={units}
          compact
          onPress={openActivity}
          onLongPress={setPendingId}
        />
      );
    },
    [openActivity, theme, units],
  );

  const keyExtractor = useCallback(
    (item: RowItem) => (item.type === 'activity' ? item.activity.id : item.key),
    [],
  );
  const getItemType = useCallback((item: RowItem) => item.type, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSort('recent');
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    // `onSuccess`, not `onSettled`: a delete that fails must leave the dialog up with the
    // reason visible, not close and leave a row the user just tried to remove sitting in the
    // list, which reads as the button having done nothing.
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingId(null) });
  }, [pendingDelete, removeActivity]);
  const cancelDelete = useCallback(() => {
    removeActivity.reset();
    setPendingId(null);
  }, [removeActivity]);

  const count = list.flat.length;
  const { durationSeconds, volumeKg } = list.totals;
  const summary = useMemo<MetaItem[]>(() => {
    if (list.isLoading || count === 0) {
      return [{ icon: 'activities', label: t('states.everySessionLands') }];
    }
    const items: MetaItem[] = [
      { icon: 'activities', label: t('activities.session', { count }) },
      { icon: 'clock', label: formatDurationCompact(durationSeconds) },
    ];
    if (volumeKg > 0) {
      items.push({ icon: 'dumbbell', label: `${compactNumber(volumeKg)} kg` });
    }
    return items;
  }, [count, durationSeconds, list.isLoading, t, volumeKg]);

  // Memoised so a re-render that changed nothing in the header (a delete dialog opening, a
  // query notification) hands FlashList the same element and leaves the header alone.
  const listHeader = useMemo(
    () => (
      <>
        <MetaLine items={summary} theme={theme} wrap style={styles.summary} />

        <View style={styles.filters}>
          <TextInput
            label={t('activityList.search')}
            value={search}
            onChangeText={setSearch}
            placeholder={t('activities.searchPlaceholder')}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('activityList.searchA11y')}
            {...(settling ? { hint: t('exerciseList.searching') } : {})}
          />
        </View>

        <View style={styles.sort}>
          <Row gap="md" align="center">
            <View style={styles.fill}>
              <SegmentedControl segments={sortSegments} value={sort} onChange={setSort} />
            </View>
            {filtering ? (
              <Button label={t('common.clear')} variant="quiet" size="sm" onPress={clearFilters} />
            ) : null}
          </Row>

          {online ? null : (
            <Txt variant="caption" tone="muted">
              {t('activityList.offlineNote')}
            </Txt>
          )}
        </View>
      </>
    ),
    [clearFilters, filtering, online, search, settling, sort, sortSegments, summary, t, theme],
  );

  const refresh = list.refresh;
  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const contentContainerStyle = useMemo(() => ({ paddingBottom: bottomSpace }), [bottomSpace]);
  const listStyle = useMemo(() => ({ backgroundColor: theme.colors.background }), [theme]);

  return (
    <>
      <ScreenHeader title={t('activities.title')} />
      {/* No bar action. The type chips and the sort control are permanently in the list
          header directly under this bar, so a funnel button here would either open a sheet
          duplicating controls that are already on screen or, as it did, fire a press that
          set the search text to what it already was. A dead icon is worse than no icon. */}

      <FlashList
        {...SCROLL_INSETS}
        key={locale}
        maintainVisibleContentPosition={NO_ANCHOR}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        extraData={units}
        contentContainerStyle={contentContainerStyle}
        refreshControl={
          <ThemedRefreshControl refreshing={list.isLoading && count > 0} onRefresh={onRefresh} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          list.isLoading ? (
            // `SkeletonList` carries the screen gutter itself.
            <View style={styles.skeleton}>
              <SkeletonList rows={6} />
            </View>
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={onRefresh} title={t('activityList.historyError')} />
          ) : filtering ? (
            <EmptyState
              title={t('activityList.noMatchTitle')}
              message={t('activityList.noMatchMessage')}
              icon="search"
              actionLabel={t('activityList.clearFilters')}
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              title={t('activityList.emptyTitle')}
              message={t('activityList.emptyMessage')}
              icon="activities"
              actionLabel={t('activityList.startWorkout')}
              // A `replace`, not a push: this is a tab, and pushing it would stack a second
              // copy of the tab bar on the one the user is standing on.
              onAction={() => router.replace(routes.workoutTab())}
            />
          )
        }
        style={listStyle}
      />

      {pendingDelete ? (
        <ConfirmDialog
          visible={!removeActivity.isPending}
          title={t('activityList.deleteTitle')}
          message={
            removeActivity.isError
              ? removeActivity.error instanceof Error
                ? removeActivity.error.message
                : t('activity.deleteFailed')
              : t('activity.deleteMessage', { name: pendingDelete.title })
          }
          confirmLabel={t('activity.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      ) : null}
    </>
  );
}

/**
 * FlashList v2 pins the first visible row across data changes, which suits a feed that grows
 * at the top and is wrong for a re-sort: the row it pins moves far down the new order, so the
 * list scrolls away from the sort control the user just tapped. A re-sort keeps the offset.
 */
const NO_ANCHOR = { disabled: true } as const;

const HEADING_DATE = new Map<string, Intl.DateTimeFormat>();

/**
 * A day heading: "Today", "Yesterday", then the weekday and date, in the app's language.
 *
 * Not sticky. FlashList pins headers by index against the flat data, which fights the
 * two-item-type recycling this list depends on, and a heading that mis-pinned by one row
 * is worse than one that scrolls.
 */
function dayHeading(midnight: number, t: (key: TKey, vars?: TVars) => string, locale: string): string {
  const days = daysBetween(midnight, Date.now());
  if (days === 0) return t('activities.today');
  if (days === 1) return t('activities.yesterday');
  let fmt = HEADING_DATE.get(locale);
  if (fmt === undefined) {
    fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    HEADING_DATE.set(locale, fmt);
  }
  return fmt.format(midnight);
}

const styles = StyleSheet.create({
  summary: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  filters: { paddingHorizontal: screenGutter, paddingTop: spacing.lg },
  sort: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  fill: { flex: 1, minWidth: 0 },
  skeleton: { paddingTop: spacing.lg },
  dayLabel: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl, marginBottom: spacing.xs },
});
