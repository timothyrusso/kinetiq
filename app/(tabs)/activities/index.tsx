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
 * recency drops the day headings entirely. The date is still in every row's subtitle; the
 * headings just stop claiming to be an ordering.
 *
 * ## Search is local and debounced
 *
 * History is in SQLite, so search is a `LIKE` inside the query rather than a filter in JS:
 * it scales past what an in-memory filter would, and it means the debounce is the only rate
 * limiter needed. The query key carries the *debounced* string: one fetch per pause rather
 * than one per keystroke: and the field shows "Searching…" while the input runs ahead of
 * the data, which is the only feedback that says a keystroke was received.
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
import { MetaLine, type MetaItem } from '@/ui/display';
import { ActivityRow } from '@/ui/rows';
import { Row } from '@/ui/layout';
import { MetricLabel, Txt } from '@/ui/Text';
import { Chip, SegmentedControl } from '@/ui/controls';
import { TextField } from '@/ui/TextField';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityList, useDeleteActivity } from '@/queries/useActivities';
import type { ActivityListParams, ActivitySort } from '@/query/keys';
import { useSettings } from '@/settings/hooks';
import { useIsOnline } from '@/query/networkStatus';
import { activityDisplay } from '@/domain/display';
import type { Activity, ActivityKind } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { useT } from '@/i18n/useT';
import { spacing, screenGutter } from '@/theme/tokens';
import { compactNumber, formatDistance, formatDurationCompact } from '@/utils/format';
import { toggleInArray } from '@/utils/functional';
import { useDebouncedValue, useIsSettling } from '@/utils/useDebouncedValue';
import type { TKey } from '@/i18n';

/** A list row is either a session or a heading above a run of sessions. */
type RowItem =
  | { type: 'activity'; activity: Activity }
  | { type: 'label'; key: string; text: string; count: number };

const KIND_CHIPS: readonly {
  kind: ActivityKind;
  /** A catalog key: this table is built at import time, where there is no language. */
  label: TKey;
  icon: 'run' | 'bike' | 'dumbbell' | 'walk' | 'yoga';
}[] = [
  { kind: 'run', label: 'activities.kindRuns', icon: 'run' },
  { kind: 'ride', label: 'activities.kindRides', icon: 'bike' },
  { kind: 'lift', label: 'activities.kindStrength', icon: 'dumbbell' },
  { kind: 'walk', label: 'activities.kindWalks', icon: 'walk' },
  { kind: 'yoga', label: 'activities.kindYoga', icon: 'yoga' },
];

const SORTS: readonly { value: ActivitySort; label: TKey }[] = [
  { value: 'recent', label: 'activities.sortRecent' },
  { value: 'duration', label: 'activities.sortLongest' },
  { value: 'distance', label: 'activities.sortFurthest' },
  { value: 'volume', label: 'activities.sortHeaviest' },
];

/** Clearance for the floating tab bar. */

export default function ActivitiesScreen() {
  const { t } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const online = useIsOnline();

  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);

  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [sort, setSort] = useState<ActivitySort>('recent');
  // Segment labels are catalog keys in the table above; resolved here, memoised on `t` so a
  // new array does not defeat SegmentedControl's memo on every unrelated re-render.
  const sortSegments = useMemo(
    () => SORTS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );

  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const settling = useIsSettling(search, debouncedSearch);
  const trimmed = debouncedSearch.trim();

  // Rebuilt only when a filter changes: `useActivityList` keys on the object's contents, so
  // a fresh literal every render would be a fresh query every render.
  const params = useMemo<ActivityListParams>(
    () => ({ kinds, search: trimmed, sort, groupBy: sort === 'recent' ? 'day' : 'none' }),
    [kinds, sort, trimmed],
  );

  const list = useActivityList(params);
  const removeActivity = useDeleteActivity();
  const filtering = kinds.length > 0 || trimmed.length > 0;

  const rows = useMemo<RowItem[]>(() => {
    if (sort !== 'recent') {
      return list.flat.map((activity) => ({ type: 'activity', activity }) as RowItem);
    }
    const out: RowItem[] = [];
    for (const group of list.groups) {
      out.push({ type: 'label', key: `g-${group.key}`, text: group.label, count: group.activities.length });
      for (const activity of group.activities) {
        out.push({ type: 'activity', activity } as RowItem);
      }
    }
    return out;
  }, [list.flat, list.groups, sort]);

  const openActivity = useCallback(
    (id: string) => router.push(routes.activityDetail(id)),
    [router],
  );

  const requestDelete = useCallback((activity: Activity) => {
    setPendingDelete(activity);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.type === 'label') {
        return <DayLabel text={item.text} count={item.count} />;
      }
      const display = activityDisplay(item.activity, units, showSpeed);
      return (
        <ActivityRow
          activity={item.activity}
          theme={theme}
          headline={display.headline}
          subtitle={display.subtitle}
          onPress={() => openActivity(item.activity.id)}
          onLongPress={() => requestDelete(item.activity)}
        />
      );
    },
    [openActivity, requestDelete, showSpeed, theme, units],
  );

  const keyExtractor = useCallback(
    (item: RowItem) => (item.type === 'activity' ? item.activity.id : item.key),
    [],
  );
  const getItemType = useCallback((item: RowItem) => item.type, []);

  const clearFilters = useCallback(() => {
    setKinds([]);
    setSearch('');
    setSort('recent');
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    // `onSuccess`, not `onSettled`: a delete that fails must leave the sheet open with
    // the reason visible, not close and leave a row the user just tried to remove sitting
    // in the list, which reads as the button having done nothing.
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
  }, [pendingDelete, removeActivity]);

  const summary = useMemo<MetaItem[]>(() => {
    if (list.isLoading || list.flat.length === 0) {
      return [{ icon: 'activities', label: t('states.everySessionLands') }];
    }
    const items: MetaItem[] = [
      { icon: 'activities', label: t('activities.session', { count: list.flat.length }) },
      { icon: 'clock', label: formatDurationCompact(list.totals.durationSeconds) },
    ];
    if (list.totals.distanceMeters > 0) {
      items.push({ icon: 'route', label: formatDistance(list.totals.distanceMeters, units, 1) });
    }
    if (list.totals.volumeKg > 0) {
      items.push({ icon: 'dumbbell', label: `${compactNumber(list.totals.volumeKg)} kg` });
    }
    return items;
  }, [list.flat.length, list.isLoading, list.totals, t, units]);

  const listHeader = (
    <>
      <MetaLine items={summary} theme={theme} wrap style={styles.summary} />

      <View style={styles.filters}>
        <TextField
          label={t('activityList.search')}
          value={search}
          onChangeText={setSearch}
          placeholder={t('activities.searchPlaceholder')}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('activityList.searchA11y')}
          {...(settling ? { hint: t('exerciseList.searching') } : {})}
        />

        <View style={styles.chips}>
          {KIND_CHIPS.map((chip) => (
            <Chip
              key={chip.kind}
              label={t(chip.label)}
              icon={chip.icon}
              size="sm"
              selected={kinds.includes(chip.kind)}
              onPress={() => setKinds((prev) => toggleInArray(prev, chip.kind))}
            />
          ))}
        </View>

        <Row gap="md" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <SegmentedControl segments={sortSegments} value={sort} onChange={setSort} />
          </View>
          {filtering ? <Button label={t('common.clear')} variant="quiet" size="sm" onPress={clearFilters} /> : null}
        </Row>

        {online ? null : (
          <Txt variant="caption" tone="muted">
            {t('activityList.offlineNote')}
          </Txt>
        )}
      </View>
    </>
  );

  return (
    <>
      <ScreenHeader title={t('activities.title')} />
      {/* No bar action. The type chips and the sort control are permanently in the list
          header directly under this bar, so a funnel button here would either open a sheet
          duplicating controls that are already on screen or, as it did, fire a press that
          set the search text to what it already was. A dead icon is worse than no icon. */}

      <FlashList
        {...SCROLL_INSETS}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        extraData={units}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        refreshControl={
          <ThemedRefreshControl
            refreshing={list.isLoading && list.flat.length > 0}
            onRefresh={() => void list.refresh()}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={{ paddingHorizontal: screenGutter, paddingTop: spacing.lg }}>
              <SkeletonList rows={6} />
            </View>
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={() => void list.refresh()} title={t('activityList.historyError')} />
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
        style={{ backgroundColor: theme.colors.background }}
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
          onCancel={() => {
            removeActivity.reset();
            setPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * A day heading.
 *
 * Not sticky. FlashList pins headers by index against the flat data, which fights the
 * two-item-type recycling this list depends on, and a heading that mis-pinned by one row
 * is worse than one that scrolls.
 */
function DayLabel({ text, count }: { text: string; count: number }) {
  if (!text) return null;
  return (
    <Row align="end" justify="between" style={styles.dayLabel}>
      <MetricLabel label={text} />
      <Txt variant="micro" tone="faint">
        {count} {count === 1 ? 'session' : 'sessions'}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  summary: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  filters: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayLabel: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
});
