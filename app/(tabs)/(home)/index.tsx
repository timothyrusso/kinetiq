/**
 * Home: the training load, then every workout, newest first.
 *
 * ## Two blocks, in the order people ask
 *
 * *Am I training enough* is the load card: minutes per week for six weeks, this week and the
 * weekly average above it. *What did I do* is the history under it, grouped by week. That is
 * the whole screen: there is no second history list anywhere in the app, so this one is not a
 * preview with a "See all", it is all.
 *
 * ## Why the FlashList owns the scroll
 *
 * There is no outer `ScrollView`. The native large title collapses by coupling to the
 * screen's first scroll view, and nesting a virtualised list in a scroll view defeats the
 * virtualisation. So the load card is `ListHeaderComponent`, and the week headings are rows of
 * their own item type, so a heading is never recycled into a card.
 *
 * ## Why the header content is memoised
 *
 * FlashList re-lays out whenever its header element changes. Memoised, a render that changed
 * nothing the card shows (a refetch settling, a delete dialog opening) leaves it alone.
 *
 * ## Delete is a long press, confirmed
 *
 * The row's tap opens the session; a long press asks to delete it. The dialog closes only on
 * success, so a delete that fails leaves the reason on screen instead of a row that looks as if
 * the button did nothing.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useTabContentBottom } from '@/ui/insets';
import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { ActivityCard, SectionHeader, StatTile } from '@/ui/display';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { Card, Row } from '@/ui/layout';
import { WeeklyBars, type WeeklyBar } from '@/ui/charts/WeeklyBars';
import { EmptyState, ErrorState, SkeletonCard, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityHistory, useDeleteActivity } from '@/queries/useActivities';
import { useTrainingSummary, type TrainingSummary } from '@/queries/useProgress';
import { useSettings } from '@/settings/hooks';
import type { Activity } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme, type Theme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
import type { TKey, TVars } from '@/i18n';
import { weekHeading } from '@/utils/relativeTime';
import type { UnitSystem } from '@/utils/format';

/** Weeks drawn in the load chart. */
const LOAD_WEEKS = 6;

type Translate = (key: TKey, vars?: TVars) => string;

/** A row is a week heading or a workout. */
type RowItem =
  | { type: 'week'; key: string; label: string; count: number; first: boolean }
  | { type: 'workout'; activity: Activity };

export default function HomeScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const units = useSettings((s) => s.unitSystem);

  const summaryQuery = useTrainingSummary(LOAD_WEEKS);
  const history = useActivityHistory();
  const removeActivity = useDeleteActivity();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Headings are phrased here rather than in the query: they are in the app's language, and
  // the query layer has no language.
  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    for (const week of history.weeks) {
      out.push({
        type: 'week',
        key: `w-${week.weekStart}`,
        label: weekHeading(week.weekStart, t, locale),
        count: week.activities.length,
        first: out.length === 0,
      });
      for (const activity of week.activities) out.push({ type: 'workout', activity });
    }
    return out;
  }, [history.weeks, locale, t]);

  const pendingDelete = useMemo(
    () => (pendingId === null ? null : (history.activities.find((a) => a.id === pendingId) ?? null)),
    [history.activities, pendingId],
  );

  const openActivity = useCallback((id: string) => router.push(routes.activityDetail(id)), [router]);
  const openWorkoutTab = useCallback(() => router.push(routes.workoutTab()), [router]);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) =>
      item.type === 'week' ? (
        <SectionHeader
          title={item.label}
          counter={item.count}
          style={item.first ? styles.firstWeek : styles.week}
        />
      ) : (
        <WorkoutCell
          activity={item.activity}
          theme={theme}
          units={units}
          onPress={openActivity}
          onLongPress={setPendingId}
        />
      ),
    [openActivity, theme, units],
  );
  const keyExtractor = useCallback(
    (item: RowItem) => (item.type === 'workout' ? item.activity.id : item.key),
    [],
  );
  const getItemType = useCallback((item: RowItem) => item.type, []);

  const { refetch: refetchSummary } = summaryQuery;
  const { refresh: refetchHistory } = history;
  const refresh = useCallback(() => {
    void refetchHistory();
    void refetchSummary();
  }, [refetchHistory, refetchSummary]);
  const retrySummary = useCallback(() => void refetchSummary(), [refetchSummary]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingId(null) });
  }, [pendingDelete, removeActivity]);
  const cancelDelete = useCallback(() => {
    // A reopened dialog must not report the previous attempt's failure.
    removeActivity.reset();
    setPendingId(null);
  }, [removeActivity]);

  const summary = summaryQuery.data;
  const listHeader = useMemo(
    () =>
      history.isEmpty ? null : (
        <View style={styles.load}>
          {summaryQuery.isPending ? (
            <SkeletonCard lines={3} />
          ) : summaryQuery.isError ? (
            <ErrorState error={summaryQuery.error} onRetry={retrySummary} compact />
          ) : summary ? (
            <TrainingLoad summary={summary} theme={theme} t={t} />
          ) : null}
        </View>
      ),
    [history.isEmpty, retrySummary, summary, summaryQuery.error, summaryQuery.isError, summaryQuery.isPending, t, theme],
  );

  const listEmpty = useMemo(
    () =>
      history.isLoading ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={4} />
        </View>
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={refresh} title={t('home.historyError')} />
      ) : (
        <EmptyState
          title={t('home.emptyTitle')}
          message={t('home.emptyMessage')}
          icon="dumbbell"
          actionLabel={t('home.startWorkout')}
          onAction={openWorkoutTab}
        />
      ),
    [history.error, history.isLoading, openWorkoutTab, refresh, t],
  );
  const contentContainerStyle = useMemo(() => ({ paddingBottom: bottomSpace }), [bottomSpace]);
  const listStyle = useMemo(() => ({ backgroundColor: theme.colors.background }), [theme]);

  return (
    <>
      <ScreenHeader title={t('tabs.home')} />

      <FlashList
        {...SCROLL_INSETS}
        // Keyed by locale: a card phrases its metadata with `tr()`, and its memo would keep the
        // old language until the row recycled.
        key={locale}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        extraData={units}
        contentContainerStyle={contentContainerStyle}
        refreshControl={
          <ThemedRefreshControl refreshing={history.isFetching && !history.isLoading} onRefresh={refresh} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={listStyle}
      />
      {/* No resume pill here: the tab bar's accessory owns it, for every tab. */}

      {pendingDelete ? (
        <ConfirmDialog
          visible={!removeActivity.isPending}
          title={t('activity.deleteTitle')}
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
 * One workout card with the gutter and the gap below, so the card fills the width it is
 * given and the list builds no style object per row. `onPress` and `onLongPress` take the id,
 * so every row gets the same two callbacks.
 */
const WorkoutCell = memo(function WorkoutCell({
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
    <View style={styles.cell}>
      <ActivityCard
        activity={activity}
        theme={theme}
        units={units}
        thumbnail="chart"
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </View>
  );
});

/**
 * Minutes per week, six weeks, oldest on the left.
 *
 * The bars carry bare minutes: the eyebrow names the unit once, and "144 min" six times over
 * does not fit a sixth of a phone card in Italian. `WeekSummary.label` is "Sep 1", which is
 * what a weekly bar wants; labelling by weekday would put "Mon" under all six.
 *
 * Memoised, with `t` as a prop so a language change still reaches it.
 */
const TrainingLoad = memo(function TrainingLoad({
  summary,
  theme,
  t,
}: {
  summary: TrainingSummary;
  theme: Theme;
  t: Translate;
}) {
  const load = useMemo(() => {
    const weeks = summary.weeks.slice(-LOAD_WEEKS);
    const bars: WeeklyBar[] = weeks.map((w, index) => {
      const minutes = Math.round(w.durationSeconds / 60);
      const current = index === weeks.length - 1;
      return {
        key: `${w.weekStart}`,
        label: current ? t('tabsHome.nowBar') : w.label,
        value: minutes,
        valueLabel: `${minutes}`,
        current,
      };
    });
    // The average is over the finished weeks only: the current one is still being filled, and
    // counting it would drag the average down every Monday.
    const past = bars.slice(0, -1);
    const average =
      past.length > 0 ? Math.round(past.reduce((sum, b) => sum + b.value, 0) / past.length) : null;
    const a11y = t('home.loadA11y', {
      weeks: bars.map((b) => t('home.loadA11yWeek', { week: b.label, value: b.value })).join(', '),
    });
    return { bars, current: bars.at(-1)?.value ?? 0, average, a11y };
  }, [summary.weeks, t]);

  return (
    <Card>
      <SectionHeader
        title={t('home.trainingLoad')}
        eyebrow={t('home.minutesPerWeek', { count: LOAD_WEEKS })}
        style={styles.loadTitle}
      />
      <Row gap="md" style={styles.loadTiles}>
        <StatTile value={`${load.current}`} unit={t('tabsHome.minutesUnit')} label={t('home.thisWeek')} />
        <StatTile
          value={load.average === null ? t('common.noValue') : `${load.average}`}
          {...(load.average === null ? {} : { unit: t('tabsHome.minutesUnit') })}
          label={t('home.weeklyAverage')}
        />
      </Row>
      <WeeklyBars bars={load.bars} theme={theme} accessibilityLabel={load.a11y} />
    </Card>
  );
});

const styles = StyleSheet.create({
  load: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  loadTitle: { marginBottom: spacing.lg },
  loadTiles: { marginBottom: spacing.xl },
  firstWeek: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
  week: { paddingHorizontal: screenGutter, paddingTop: spacing.xl },
  cell: { paddingHorizontal: screenGutter, paddingBottom: spacing.md },
  skeleton: { paddingTop: spacing.lg },
});
