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
 * Grouping is not reimplemented here: `groupBy: 'week'` comes from the query and the window is
 * applied per group, which keeps one implementation of "which week is this". Only the heading's
 * words are made here, from the group's key: the query's own labels are English literals, and
 * this screen names weeks relative to today ("This week", "Last week") in the user's language.
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
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { ActivityCard, MetaLine, SectionHeader, type MetaItem } from '@/ui/display';
import { useScreenContentBottom } from '@/ui/insets';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { SegmentedControl } from '@/ui/controls/SegmentedControl';
import { EmptyState, ErrorState, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityList, useDeleteActivity } from '@/queries/useActivities';
import { useSettings } from '@/settings';
import { compactNumber, formatDurationCompact } from '@/utils/format';
import { routes, tabHref, tabIndexOf } from '@/navigation/nav';
import type { ActivityListParams, ActivitySort } from '@/query/keys';
import type { Activity } from '@/domain/types';
import { useAppTheme } from '@/theme/theme';
import type { Theme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import type { UnitSystem } from '@/utils/format';
import { weekHeading } from '@/utils/relativeTime';

const DAY_MS = 86_400_000;

/** Rolling windows, labelled by what they actually are: see `windowStart`. */
type Range = '7d' | '30d' | '365d' | 'all';

const RANGES: readonly { value: Range; label: TKey }[] = [
  { value: '7d', label: 'history.range7d' },
  { value: '30d', label: 'history.range30d' },
  { value: '365d', label: 'history.rangeYear' },
  { value: 'all', label: 'history.rangeAll' },
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
  | { type: 'label'; key: string; text: string; count: number; first: boolean }
  | { type: 'activity'; activity: Activity };

const SORT: ActivitySort = 'recent';

export default function WorkoutHistoryScreen() {
  const { t, locale } = useT();
  const bottomSpace = useScreenContentBottom();
  const theme = useAppTheme();

  // 30 days is the default because it is the widest window whose entire contents are plausibly
  // remembered: "what have I done recently" is the question this screen is reached with, and a
  // first open that shows nine rows and one that shows nine hundred both answer the wrong
  // question.
  const [range, setRange] = useState<Range>('30d');
  // Segment labels are catalog keys in the table above; resolved here, memoised on `t` so a
  // new array does not defeat SegmentedControl's memo on every unrelated re-render.
  const rangeSegments = useMemo(
    () => RANGES.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const units = useSettings((s) => s.unitSystem);
  const removeActivity = useDeleteActivity();

  // The query's own week grouping (Monday start), so this screen and any other weekly view
  // cannot disagree about which week a session belongs to.
  const params = useMemo<ActivityListParams>(
    () => ({ search: '', sort: SORT, groupBy: 'week' }),
    [],
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
        text: weekHeading(group.key, t, locale),
        count: group.activities.length,
        first: out.length === 0,
      });
      for (const activity of group.activities) out.push({ type: 'activity', activity });
    }
    return out;
  }, [groups, locale, t]);

  const visible = useMemo(() => groups.flatMap((group) => group.activities), [groups]);
  const pendingDelete = useMemo(
    () => (pendingDeleteId === null ? null : list.flat.find((a) => a.id === pendingDeleteId) ?? null),
    [list.flat, pendingDeleteId],
  );

  const totals = useMemo(() => {
    let duration = 0;
    let volume = 0;
    for (const activity of visible) {
      duration += activity.durationSeconds;
      volume += activity.strength?.totalVolumeKg ?? 0;
    }
    return { duration, volume };
  }, [visible]);

  const openActivity = useCallback((id: string) => router.push(routes.activityDetail(id)), []);
  const askDelete = useCallback((id: string) => setPendingDeleteId(id), []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    // Success-only close; see the identical note in `(tabs)/activities.tsx`.
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingDeleteId(null) });
  }, [pendingDelete, removeActivity]);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.type === 'label') {
        return (
          <SectionHeader
            title={item.text}
            counter={item.count}
            style={item.first ? styles.firstWeek : styles.week}
          />
        );
      }
      return (
        <HistoryCard
          activity={item.activity}
          theme={theme}
          units={units}
          onPress={openActivity}
          onLongPress={askDelete}
        />
      );
    },
    [askDelete, openActivity, theme, units],
  );

  const keyExtractor = useCallback(
    (item: RowItem) => (item.type === 'activity' ? item.activity.id : item.key),
    [],
  );
  const getItemType = useCallback((item: RowItem) => item.type, []);

  const filtering = range !== 'all';

  const widen = useCallback(() => setRange('all'), []);

  // The range at a glance, as the first line of content now that the native title holds one
  // line: count, duration, and volume when the range has any.
  const summary = useMemo<MetaItem[]>(() => {
    if (list.isLoading) return [];
    if (visible.length === 0) return [{ icon: 'calendar', label: t('activityList.nothingInRange') }];
    return [
      { icon: 'activities', label: t('activities.session', { count: visible.length }) },
      { icon: 'clock', label: formatDurationCompact(totals.duration) },
      ...(totals.volume > 0
        ? [{ icon: 'dumbbell' as const, label: `${compactNumber(totals.volume)} kg` }]
        : []),
    ];
  }, [list.isLoading, visible.length, totals, t]);
  // Everything a card reads besides its row, so FlashList redraws visible cards when one changes.
  const extraData = useMemo(() => ({ units, theme }), [units, theme]);
  const openSearch = useCallback(
    () => router.replace(tabHref(tabIndexOf('activities'))),
    [router],
  );

  return (
    <>
      <ScreenHeader title={t('activityList.historyTitle')} largeTitle />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'search', onPress: openSearch, t, label: 'activityList.search' })}
      </HeaderToolbar>
      <FlashList
        {...SCROLL_INSETS}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        extraData={extraData}
        contentContainerStyle={{
          paddingHorizontal: screenGutter,
          paddingTop: spacing.md,
          paddingBottom: bottomSpace,
        }}
        // 44px is the segmented control and the chips below it; without this the spinner
        // appears underneath the first rows of the list.
        progressViewOffset={44}
        refreshControl={
          <ThemedRefreshControl
            refreshing={list.isLoading && rows.length > 0}
            onRefresh={() => void list.refresh()}
          />
        }
        ListHeaderComponent={
          <View style={styles.controls}>
            <MetaLine items={summary} theme={theme} wrap />
            <SegmentedControl<Range>
              segments={rangeSegments}
              value={range}
              onChange={setRange}
            />
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            // The list's own gutter already applies; a second one here indented the skeleton.
            <View style={styles.skeleton}>
              <SkeletonList rows={5} />
            </View>
          ) : list.error ? (
            <ErrorState
              error={list.error}
              onRetry={() => void list.refresh()}
              title={t('activityList.historyError')}
            />
          ) : list.flat.length === 0 ? (
            <EmptyState
              title={t('activityList.noSessionsTitle')}
              message={t('activityList.emptyMessage')}
              icon="activities"
              actionLabel={t('activityList.startWorkout')}
              onAction={() => router.replace(routes.workoutTab())}
            />
          ) : (
            <EmptyState
              title={t('activityList.nothingInRange')}
              message={t('states.outsideRange', { count: list.flat.length })}
              icon="calendar"
              {...(filtering ? { actionLabel: t('states.showEverything'), onAction: widen } : {})}
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
            // Dismissing clears the previous attempt: a dialog opened a second time should
            // not still be reporting why the *first* delete failed.
            removeActivity.reset();
            setPendingDeleteId(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * One session, as a card. Week headings are not sticky, for the same reason the Activities
 * tab's are not: FlashList pins headers by index against the flat data, which fights the
 * two-item-type recycling this list depends on.
 *
 * `onPress` and `onLongPress` take the id, so every card gets the same two callbacks.
 */
const HistoryCard = memo(function HistoryCard({
  activity,
  theme,
  units,
  onPress,
  onLongPress,
}: {
  activity: Activity;
  theme: Theme;
  units: UnitSystem;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <ActivityCard
        activity={activity}
        theme={theme}
        units={units}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  controls: { gap: spacing.md, paddingBottom: spacing.md },
  firstWeek: { paddingTop: spacing.md },
  week: { paddingTop: spacing.xxl },
  card: { paddingBottom: spacing.sm },
  skeleton: { paddingTop: spacing.lg },
});
