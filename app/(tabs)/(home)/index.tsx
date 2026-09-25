/**
 * Home: the training grid, then every workout, newest first.
 *
 * ## Two blocks, in the order people ask
 *
 * *Am I training consistently* is the GitHub-style grid: one square per day for twenty weeks,
 * shaded by minutes trained. *What did I do* is the history under it, grouped by week. That is
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
 * nothing the grid shows (a refetch settling, a delete dialog opening) leaves it alone.
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
import { ActivityCard, SectionHeader } from '@/ui/display';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { Card } from '@/ui/layout';
import { HeatmapCalendar } from '@/ui/charts/HeatmapCalendar';
import { EmptyState, ErrorState, SkeletonCard, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useActivityHistory, useDeleteActivity } from '@/queries/useActivities';
import { useTrainingHeatmap, type TrainingHeatmap } from '@/queries/useProgress';
import { useSettings } from '@/settings/hooks';
import type { Activity } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useAppTheme, type Theme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
import type { TKey, TVars } from '@/i18n';
import { weekHeading } from '@/utils/relativeTime';
import type { UnitSystem } from '@/utils/format';

/** Weeks in the grid: about five months, which keeps each square big enough to read on a phone. */
const GRID_WEEKS = 20;

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

  const summaryQuery = useTrainingHeatmap(GRID_WEEKS);
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
            <TrainingGrid heatmap={summary} theme={theme} locale={locale} t={t} />
          ) : null}
        </View>
      ),
    [history.isEmpty, locale, retrySummary, summary, summaryQuery.error, summaryQuery.isError, summaryQuery.isPending, t, theme],
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
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </View>
  );
});

/**
 * Twenty weeks of training days. Memoised, with `t` and `locale` as props so a language change
 * still reaches it.
 */
const TrainingGrid = memo(function TrainingGrid({
  heatmap,
  theme,
  locale,
  t,
}: {
  heatmap: TrainingHeatmap;
  theme: Theme;
  locale: string;
  t: Translate;
}) {
  const labels = useMemo(() => {
    const trained = heatmap.days.filter((d) => d.value > 0).length;
    const footer = t('heatmap.workouts', { count: heatmap.workouts, weeks: GRID_WEEKS });
    return {
      footer,
      a11y: t('heatmap.a11y', { days: trained, weeks: GRID_WEEKS, workouts: footer }),
    };
  }, [heatmap, t]);

  return (
    <Card>
      <SectionHeader
        title={t('heatmap.title')}
        eyebrow={t('heatmap.eyebrow', { count: GRID_WEEKS })}
        style={styles.loadTitle}
      />
      <HeatmapCalendar
        days={heatmap.days}
        theme={theme}
        locale={locale}
        accessibilityLabel={labels.a11y}
        lessLabel={t('heatmap.less')}
        moreLabel={t('heatmap.more')}
        footer={labels.footer}
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  load: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  loadTitle: { marginBottom: spacing.lg },
  firstWeek: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
  week: { paddingHorizontal: screenGutter, paddingTop: spacing.xl },
  cell: { paddingHorizontal: screenGutter, paddingBottom: spacing.md },
  skeleton: { paddingTop: spacing.lg },
});
