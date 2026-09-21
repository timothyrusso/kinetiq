/**
 * Workout history: the full log of everything finished, and the landing screen after a
 * session is saved.
 *
 * ## Why this is a screen and not just the Activities tab
 *
 * Two `router.replace` calls in `app/workout/session.tsx` land here the moment a workout is
 * saved. A finish has to go *somewhere* that is not the screen you were just sweating on, and
 * it has to go somewhere that immediately shows the thing you just did: otherwise "did that
 * save?" stays a question. So this screen is written around the newest session: newest first,
 * today's group on top, and reached by `replace` so the finished workout is not one gesture
 * away from being re-finished.
 *
 * ## Why it is not a second copy of the Activities tab
 *
 * Both read the same repository through the same `useActivityList` hook, and the overlap is
 * deliberate: two screens over one history that disagree about sorting or grouping is worse
 * than one screen that appears in two entry points. What differs is the window. The tab is a
 * *search* surface (free text, every sort); this one is a *calendar* surface (a rolling
 * 7/30/365-day range, with totals computed for exactly what is visible). Those are different
 * questions and neither answers the other.
 *
 * Grouping is not reimplemented here: `groupBy: 'day'` comes from the query and the window is
 * applied per group, which keeps one implementation of "what day is this" and means a windowed
 * view can never disagree with the tab about a heading.
 *
 * ## Totals are computed over the window, not read from the cache
 *
 * `useActivityList` returns totals for the whole filtered set. Printing those beside a 30-day
 * heading would put "182 sessions" above a list showing nine: the kind of inconsistency that
 * makes people distrust every other number on screen. So the visible rows are summed here, in
 * one pass, from the same objects the rows render.
 *
 * ## Rows carry no "PR" badge, and that is not an oversight
 *
 * The post-workout sheet can claim records because `finishSession` computes them and returns
 * them in memory. Reopening that activity later cannot: `codec.ts` reads `personalRecords` as
 * an empty array, because the `records` table keeps only the *current* best per exercise: the
 * history of which session earned which record is not stored. Deriving a badge from the current
 * records table would mark every session that contains an exercise you hold a record on, not
 * the one that set it, which is wrong for every row except the newest. Progress reads the
 * records table and is the authoritative place for that question.
 *
 * ## Limitation, stated rather than hidden
 *
 * There is no pagination because there is nothing to paginate: the whole history is in SQLite
 * on this device and one query returns it in a few milliseconds. If the log ever grows past a
 * few thousand rows, the fix belongs in `activityRepository.list` (a `limit`, plus windowed
 * rendering): not in this file, and the FlashList already keeps only the visible rows alive.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DetailScreen } from '@/ui/Screen';
import { Row } from '@/ui/layout';
import { Button } from '@/ui/Button';
import { Chip, SegmentedControl } from '@/ui/controls';
import { MetricLabel, Txt } from '@/ui/Text';
import { ActivityRow } from '@/ui/rows';
import { ConfirmSheet } from '@/ui/Sheet';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityList, useDeleteActivity } from '@/queries/useActivities';
import { activityDisplay } from '@/domain/display';
import { useSettings } from '@/settings';
import { compactNumber, formatDistance, formatDurationCompact } from '@/utils/format';
import { routes, tabHref, tabIndexOf } from '@/navigation/nav';
import type { ActivityListParams, ActivitySort } from '@/query/keys';
import type { Activity, ActivityKind } from '@/domain/types';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

const BOTTOM_SPACE = 96;
const DAY_MS = 86_400_000;

/** Rolling windows, labelled by what they actually are: see `windowStart`. */
type Range = '7d' | '30d' | '365d' | 'all';

const RANGES: readonly { value: Range; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '365d', label: 'Year' },
  { value: 'all', label: 'All' },
];

/**
 * "7 days" is a rolling week, not Monday-to-Sunday.
 *
 * Called "7 days" rather than "This week" for the same reason the streak counts the last seven
 * calendar days: a range named "This week" that empties every Monday morning reads as lost
 * data. Nobody loses anything to a window that slides.
 *
 * The day boundary is local midnight and the window is inclusive of today, so "7 days" means
 * the seven calendar days a user counts back on a calendar, not 168 wall-clock hours: a
 * session from 08:00 this morning is inside a window opened at 20:00 tonight, which is what
 * anyone expects from a fitness log.
 */
function windowStart(range: Range): number {
  if (range === 'all') return 0;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() - (days - 1) * DAY_MS;
}

type RowItem =
  | { type: 'label'; key: string; text: string; count: number }
  | { type: 'activity'; activity: Activity };

const SORT: ActivitySort = 'recent';

export default function WorkoutHistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  // 30 days is the default because it is the widest window whose entire contents are plausibly
  // remembered: "what have I done recently" is the question this screen is reached with, and a
  // first open that shows nine rows and one that shows nine hundred both answer the wrong
  // question.
  const [range, setRange] = useState<Range>('30d');
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);

  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);
  const removeActivity = useDeleteActivity();

  // The query's own day grouping, so a heading here and on the Activities tab can never
  // disagree about what day a session belongs to.
  const params = useMemo<ActivityListParams>(
    () => ({ kinds, search: '', sort: SORT, groupBy: 'day' }),
    [kinds],
  );
  const list = useActivityList(params);
  const since = useMemo(() => windowStart(range), [range]);

  const groups = useMemo(
    () =>
      list.groups
        .map((group) => ({
          ...group,
          activities: group.activities.filter((activity) => activity.startedAt >= since),
        }))
        .filter((group) => group.activities.length > 0),
    [list.groups, since],
  );

  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    for (const group of groups) {
      out.push({
        type: 'label',
        key: `g-${group.key}`,
        text: group.label,
        count: group.activities.length,
      });
      for (const activity of group.activities) out.push({ type: 'activity', activity });
    }
    return out;
  }, [groups]);

  const visible = useMemo(() => groups.flatMap((group) => group.activities), [groups]);

  const totals = useMemo(() => {
    let duration = 0;
    let distance = 0;
    let volume = 0;
    for (const activity of visible) {
      duration += activity.durationSeconds;
      distance += activity.cardio?.distanceMeters ?? 0;
      volume += activity.strength?.totalVolumeKg ?? 0;
    }
    return { duration, distance, volume };
  }, [visible]);

  const openActivity = useCallback((id: string) => router.push(routes.activityDetail(id)), []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    // Success-only close; see the identical note in `(tabs)/activities.tsx`.
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
  }, [pendingDelete, removeActivity]);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.type === 'label') return <DayLabel text={item.text} count={item.count} />;
      const display = activityDisplay(item.activity, units, showSpeed);
      return (
        <ActivityRow
          activity={item.activity}
          theme={theme}
          headline={display.headline}
          subtitle={display.subtitle}
          onPress={() => openActivity(item.activity.id)}
          onLongPress={() => setPendingDelete(item.activity)}
        />
      );
    },
    [openActivity, showSpeed, theme, units],
  );

  const keyExtractor = useCallback(
    (item: RowItem) => (item.type === 'activity' ? item.activity.id : item.key),
    [],
  );
  const getItemType = useCallback((item: RowItem) => item.type, []);

  const filtering = kinds.length > 0 || range !== 'all';

  const widen = useCallback(() => {
    setRange('all');
    setKinds([]);
  }, []);

  const summary = list.isLoading
    ? 'Loading…'
    : visible.length === 0
      ? 'Nothing in this range'
      : // Three segments at most. This renders into a fixed-height bar that also carries the
        // Search button, and `numberOfLines={1}` truncates whatever does not fit: with four
        // segments that landed mid-number ("24 sessions · 17h 21m · 127.6…"), which reads as
        // a broken value rather than as an abbreviated summary. Count and duration always
        // apply; the third is whichever of distance or volume this range actually has, and
        // when it has both, distance wins because every strength row already shows its own
        // volume and Progress carries the full breakdown.
        [
          `${visible.length} ${visible.length === 1 ? 'session' : 'sessions'}`,
          formatDurationCompact(totals.duration),
          ...(totals.distance > 0
            ? [formatDistance(totals.distance, units, 1)]
            : totals.volume > 0
              ? [`${compactNumber(totals.volume)} kg`]
              : []),
        ].join(' · ');

  return (
    <>
      <DetailScreen
        title="History"
        subtitle={summary}
        right={
          <Button
            label="Search"
            variant="quiet"
            size="sm"
            icon="search"
            onPress={() => router.replace(tabHref(tabIndexOf('activities')))}
            accessibilityHint="Search every session by name, note or exercise"
          />
        }
      >
        {(topInset) => (
          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            extraData={units}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: topInset + spacing.md,
              paddingBottom: BOTTOM_SPACE + insets.bottom,
            }}
            // 44px is the segmented control and the chips below it; without this the spinner
            // appears underneath the first rows of the list.
            progressViewOffset={topInset + 44}
            refreshControl={
              <ThemedRefreshControl
                refreshing={list.isLoading && rows.length > 0}
                onRefresh={() => void list.refresh()}
              />
            }
            ListHeaderComponent={
              <View style={styles.controls}>
                <SegmentedControl<Range> segments={RANGES} value={range} onChange={setRange} />
                <Row gap="sm" style={styles.chips}>
                  {KIND_CHIPS.map((chip) => (
                    <Chip
                      key={chip.kind}
                      label={chip.label}
                      icon={chip.icon}
                      size="sm"
                      selected={kinds.includes(chip.kind)}
                      onPress={() =>
                        setKinds((prev) =>
                          prev.includes(chip.kind)
                            ? prev.filter((k) => k !== chip.kind)
                            : [...prev, chip.kind],
                        )
                      }
                    />
                  ))}
                </Row>
              </View>
            }
            ListEmptyComponent={
              list.isLoading ? (
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                  <SkeletonList rows={5} />
                </View>
              ) : list.error ? (
                <ErrorState
                  error={list.error}
                  onRetry={() => void list.refresh()}
                  title="Could not read your history"
                />
              ) : list.flat.length === 0 ? (
                <EmptyState
                  title="No sessions yet"
                  message="Finish a workout or record a run and it lands here: route, splits, every set."
                  icon="activities"
                  actionLabel="Start a workout"
                  onAction={() => router.replace(routes.workoutTab())}
                />
              ) : (
                <EmptyState
                  title="Nothing in this range"
                  message={`You have ${list.flat.length} ${
                    list.flat.length === 1 ? 'session' : 'sessions'
                  } outside it. Widen the window to see them.`}
                  icon="calendar"
                  {...(filtering ? { actionLabel: 'Show everything', onAction: widen } : {})}
                />
              )
            }
            style={{ backgroundColor: theme.colors.background }}
          />
        )}
      </DetailScreen>

      {pendingDelete ? (
        <ConfirmSheet
          title="Delete this session?"
          message={`"${pendingDelete.title}" and its route will be removed. Personal records it set are recalculated from what remains.`}
          confirmLabel={removeActivity.isPending ? 'Deleting…' : 'Delete'}
          onConfirm={confirmDelete}
          onRequestClose={() => {
            // Dismissing clears the previous attempt: a sheet opened a second time should
            // not still be reporting why the *first* delete failed.
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
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * A day heading. Not sticky, for the same reason the Activities tab's are not: FlashList pins
 * headers by index against the flat data, which fights the two-item-type recycling this list
 * depends on, and a heading mis-pinned by one row is worse than one that scrolls.
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

/** Icons are named per kind, so the tuple type keeps this in step with `IconName`. */
const KIND_CHIPS: readonly {
  kind: ActivityKind;
  label: string;
  icon: 'run' | 'bike' | 'dumbbell' | 'walk' | 'yoga';
}[] = [
  { kind: 'run', label: 'Runs', icon: 'run' },
  { kind: 'ride', label: 'Rides', icon: 'bike' },
  { kind: 'lift', label: 'Strength', icon: 'dumbbell' },
  { kind: 'walk', label: 'Walks', icon: 'walk' },
  { kind: 'yoga', label: 'Yoga', icon: 'yoga' },
];

const styles = StyleSheet.create({
  controls: { gap: spacing.md, paddingBottom: spacing.md },
  chips: { flexWrap: 'wrap' },
  dayLabel: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
});
