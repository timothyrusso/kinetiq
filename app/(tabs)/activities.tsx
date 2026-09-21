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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabContentBottom } from '@/ui/insets';

import { CollapsibleHeader, CollapsibleHero, useScreenHeaderScroll } from '@/ui/Screen';
import { ActivityRow } from '@/ui/rows';
import { Row } from '@/ui/layout';
import { MetricLabel, Txt } from '@/ui/Text';
import { Chip, SegmentedControl } from '@/ui/controls';
import { TextField } from '@/ui/TextField';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { ConfirmSheet } from '@/ui/Sheet';
import { useActivityList, useDeleteActivity } from '@/queries/useActivities';
import type { ActivityListParams, ActivitySort } from '@/query/keys';
import { useSettings } from '@/settings/hooks';
import { useIsOnline } from '@/query/networkStatus';
import { activityDisplay } from '@/domain/display';
import type { Activity, ActivityKind } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { compactNumber, formatDistance, formatDurationCompact } from '@/utils/format';
import { toggleInArray } from '@/utils/functional';
import { useDebouncedValue, useIsSettling } from '@/utils/useDebouncedValue';

/** A list row is either a session or a heading above a run of sessions. */
type RowItem =
  | { type: 'activity'; activity: Activity }
  | { type: 'label'; key: string; text: string; count: number };

const KIND_CHIPS: readonly { kind: ActivityKind; label: string; icon: 'run' | 'bike' | 'dumbbell' | 'walk' | 'yoga' }[] = [
  { kind: 'run', label: 'Runs', icon: 'run' },
  { kind: 'ride', label: 'Rides', icon: 'bike' },
  { kind: 'lift', label: 'Strength', icon: 'dumbbell' },
  { kind: 'walk', label: 'Walks', icon: 'walk' },
  { kind: 'yoga', label: 'Yoga', icon: 'yoga' },
];

const SORTS: readonly { value: ActivitySort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'duration', label: 'Longest' },
  { value: 'distance', label: 'Furthest' },
  { value: 'volume', label: 'Heaviest' },
];

/** Clearance for the floating tab bar. */

export default function ActivitiesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabContentBottom();
  const header = useScreenHeaderScroll();
  const online = useIsOnline();

  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);

  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [sort, setSort] = useState<ActivitySort>('recent');
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

  const summaryLine = useMemo(() => {
    if (list.isLoading || list.flat.length === 0) return 'Every session you finish lands here';
    const parts = [
      `${list.flat.length} ${list.flat.length === 1 ? 'session' : 'sessions'}`,
      formatDurationCompact(list.totals.durationSeconds),
    ];
    if (list.totals.distanceMeters > 0) {
      parts.push(formatDistance(list.totals.distanceMeters, units, 1));
    }
    if (list.totals.volumeKg > 0) parts.push(`${compactNumber(list.totals.volumeKg)} kg`);
    return parts.join(' · ');
  }, [list.flat.length, list.isLoading, list.totals, units]);

  const listHeader = (
    <>
      <CollapsibleHero header={header} eyebrow="History" title="Activities">
        <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {summaryLine}
        </Txt>
      </CollapsibleHero>

      <View style={styles.filters}>
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Session name, notes, exercise"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search activities"
          {...(settling ? { hint: 'Searching…' } : {})}
        />

        <View style={styles.chips}>
          {KIND_CHIPS.map((chip) => (
            <Chip
              key={chip.kind}
              label={chip.label}
              icon={chip.icon}
              size="sm"
              selected={kinds.includes(chip.kind)}
              onPress={() => setKinds((prev) => toggleInArray(prev, chip.kind))}
            />
          ))}
        </View>

        <Row gap="md" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <SegmentedControl segments={SORTS} value={sort} onChange={setSort} />
          </View>
          {filtering ? <Button label="Clear" variant="quiet" size="sm" onPress={clearFilters} /> : null}
        </Row>

        {online ? null : (
          <Txt variant="caption" tone="muted">
            Offline: your history is stored on this device, so everything below is intact.
          </Txt>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      {/* No bar action. The type chips and the sort control are permanently in the list
          header directly under this bar, so a funnel button here would either open a sheet
          duplicating controls that are already on screen or, as it did, fire a press that
          set the search text to what it already was. A dead icon is worse than no icon. */}
      <CollapsibleHeader header={header} title="Activities" />

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        extraData={units}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        progressViewOffset={insets.top + 52}
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
            <ErrorState error={list.error} onRetry={() => void list.refresh()} title="Could not read your history" />
          ) : filtering ? (
            <EmptyState
              title="Nothing matches"
              message="No session fits those filters. Try widening the search or clearing a type."
              icon="search"
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              title="No activities yet"
              message="Finish a workout or record a run and it lands here: route, splits, every set."
              icon="activities"
              actionLabel="Start a workout"
              // A `replace`, not a push: this is a tab, and pushing it would stack a second
              // copy of the tab bar on the one the user is standing on.
              onAction={() => router.replace(routes.workoutTab())}
            />
          )
        }
        style={{ backgroundColor: theme.colors.background }}
      />

      {pendingDelete ? (
        <ConfirmSheet
          title="Delete this session?"
          message={`"${pendingDelete.title}" and its route will be removed. Personal records it set are recalculated from what remains.`}
          confirmLabel={removeActivity.isPending ? 'Deleting…' : 'Delete'}
          onConfirm={confirmDelete}
          onRequestClose={() => {
            removeActivity.reset();
            setPendingDelete(null);
          }}
          {...(removeActivity.isError
            ? {
                error:
                  removeActivity.error instanceof Error
                    ? removeActivity.error.message
                    : 'The session could not be deleted.',
              }
            : {})}
        />
      ) : null}
    </View>
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
  root: { flex: 1 },
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
