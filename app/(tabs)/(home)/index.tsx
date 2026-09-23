/**
 * Home: the daily answer to "did I train, and am I getting anywhere?"
 *
 * ## Order, which is the whole design
 *
 * Four questions, answered top to bottom in the order people ask them: *did I train*
 * (the hero's three tiles: today's minutes, the streak, the weekly goal), *how much this
 * week* (the metric card), *what did I do* (recent sessions, as cards), *is it working*
 * (the six-week load chart, then the mix). The donut is last and smallest on purpose: it
 * is interesting once a month and noise the rest of the time.
 *
 * ## Why the FlashList owns the scroll
 *
 * There is no outer `ScrollView`. The native large title collapses by coupling to the
 * screen's first scroll view, and nesting a virtualised list in a scroll view defeats the
 * virtualisation. So everything: hero, summary cards, rows: is list content, and
 * `ListHeaderComponent` is where the part above the rows goes.
 *
 * ## Why the header content is memoised
 *
 * The list header is most of this screen: two SVG charts, a ring's worth of tiles, the clock.
 * As an inline element it was a new header on every render of this component, and FlashList
 * re-lays out whenever its header element changes. Memoised, a render that changed nothing
 * the header shows (a refetch settling, a units change elsewhere) leaves it alone, and the
 * clock ticking inside it re-renders two text nodes, not the header.
 *
 * ## One read, two numbers
 *
 * The recent list is fetched at 60 rows and used twice: the top 7 render, and all 60
 * feed the current streak. Fetching a second, longer list purely to count consecutive
 * days would be a second pass over the same table for one integer, and capping the
 * streak query at 7 would silently report a 12-day streak as 7: wrong in exactly the
 * direction the user is proud of.
 */
import { memo, useCallback, useMemo, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useTabContentBottom } from '@/ui/insets';

import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { ActivityCard, SectionHeader, StatTile, type Trend } from '@/ui/display';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { LiveClock } from '@/ui/LiveClock';
import { Card, Divider, MetricGrid, Row, Stack } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { BarChart, type BarPoint } from '@/ui/charts/BarChart';
import { ActivityDistribution, type DistributionSlice } from '@/ui/charts/ActivityDistribution';
import { useMeasuredWidth } from '@/ui/charts/useMeasuredWidth';
import { EmptyState, ErrorState, SkeletonCard, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useRecentActivities } from '@/queries/useActivities';
import { useTrainingSummary, type TrainingSummary } from '@/queries/useProgress';
import { useSettings } from '@/settings/hooks';
import { KIND_ORDER } from '@/domain/display';
import { computeStreak } from '@/domain/logic';
import type { Activity } from '@/domain/types';
import { routes, tabHref } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
import type { TKey, TVars } from '@/i18n';
import {
  compactNumber,
  formatDurationCompact,
  formatDistance,
  startOfDay,
  type UnitSystem,
} from '@/utils/format';

/** Rows actually shown. The fetched set is longer: see the header note on streaks. */
const RECENT_VISIBLE = 7;
const RECENT_FETCHED = 60;

/** `Card`'s default `padding='lg'`, subtracted from any chart that must fit inside one. */
const CARD_PADDING = spacing.lg;
const CHART_HEIGHT = 140;

type Translate = (key: TKey, vars?: TVars) => string;

export default function HomeScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const [chartWidth, onChartLayout] = useMeasuredWidth();
  // The hook hands back a new handler every render; the memoised header below needs one that
  // keeps its identity, or the memo would be rebuilt on every render and buy nothing.
  const chartLayoutRef = useRef(onChartLayout);
  chartLayoutRef.current = onChartLayout;
  const onSummaryLayout = useCallback((e: LayoutChangeEvent) => chartLayoutRef.current(e), []);

  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);
  const goal = useSettings((s) => s.weeklyGoalWorkouts);
  const profileName = useSettings((s) => s.profile.name);

  const summaryQuery = useTrainingSummary(8);
  const recentQuery = useRecentActivities(RECENT_FETCHED);

  const summary = summaryQuery.data;
  const fetched = useMemo(() => recentQuery.data ?? [], [recentQuery.data]);
  const visible = useMemo(() => fetched.slice(0, RECENT_VISIBLE), [fetched]);
  const streak = useMemo(() => computeStreak(fetched), [fetched]);
  const todaySeconds = useMemo(() => {
    const midnight = startOfDay(new Date()).getTime();
    let total = 0;
    for (const activity of fetched) if (activity.startedAt >= midnight) total += activity.durationSeconds;
    return total;
  }, [fetched]);

  const loading = summaryQuery.isPending && !summaryQuery.isError;
  // `weeks` is oldest-first, so the current week is the *last* entry. See the contract in
  // `useProgress.ts`: reading index 0 instead shows a week four (or seven) ago as today,
  // with numbers plausible enough that nothing looks broken.
  const weekWorkouts = summary?.weeks.at(-1)?.workouts ?? 0;

  const openActivity = useCallback(
    (id: string) => router.push(routes.activityDetail(id)),
    [router],
  );
  const openSettings = useCallback(() => router.push(routes.settings()), [router]);
  const openActivities = useCallback(() => router.push(tabHref(1)), [router]);
  const openWorkoutTab = useCallback(() => router.push(tabHref(2)), [router]);

  const renderItem = useCallback(
    ({ item }: { item: Activity }) => (
      // A cell with the gutter and the gap below, so the card itself fills the width it is
      // given and the list builds no style object per row.
      <View style={styles.cardCell}>
        <ActivityCard
          activity={item}
          theme={theme}
          units={units}
          showSpeedInsteadOfPace={showSpeed}
          thumbnail={item.kind === 'lift' ? 'chart' : 'map'}
          onPress={openActivity}
        />
      </View>
    ),
    [openActivity, showSpeed, theme, units],
  );

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  const { refetch: refetchRecent } = recentQuery;
  const { refetch: refetchSummary } = summaryQuery;
  const refresh = useCallback(() => {
    void refetchRecent();
    void refetchSummary();
  }, [refetchRecent, refetchSummary]);
  const retrySummary = useCallback(() => void refetchSummary(), [refetchSummary]);

  const empty = summary !== undefined && !summary.hasAnyHistory && !loading;
  const hasHistory = summary?.hasAnyHistory === true;

  const listHeader = useMemo(
    () => (
      <>
        {/* The first content block: the day at a glance, as three numbers. */}
        <Stack gap="md" style={styles.hero}>
          <Txt variant="micro" tone="faint" uppercase tracking={1.1}>
            {greeting(t)}
          </Txt>
          <Txt variant="headline">{headlineFor(streak.current, summary, t)}</Txt>
          {/* Its own component so the per-second tick re-renders two Txt nodes rather than
              the header and everything the header is a child of. */}
          <LiveClock locale={locale} />
          {hasHistory ? (
            <Row gap="md" style={styles.tiles}>
              <StatTile
                value={`${Math.round(todaySeconds / 60)}`}
                unit={t('tabsHome.minutesUnit')}
                label={t('tabsHome.today')}
              />
              <StatTile
                value={`${streak.current}`}
                unit={t('homeHero.streakUnit', { count: streak.current })}
                label={t('tabsHome.streak')}
              />
              <StatTile
                value={`${weekWorkouts}`}
                unit={t('tabsHome.goalOf', { goal })}
                label={t('tabsHome.weeklyGoal')}
              />
            </Row>
          ) : null}
        </Stack>

        <View style={styles.summary} onLayout={onSummaryLayout}>
          {loading ? (
            <Stack gap="lg">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
            </Stack>
          ) : summaryQuery.isError ? (
            <ErrorState error={summaryQuery.error} onRetry={retrySummary} compact />
          ) : summary ? (
            <HomeSummary summary={summary} units={units} chartWidth={chartWidth} t={t} />
          ) : null}
        </View>

        {empty ? null : (
          <SectionHeader
            title={t('homeTab.recent')}
            eyebrow={t('homeTab.latestSessions')}
            style={styles.recentHeader}
            {...(visible.length > 0
              ? { action: { label: t('homeTab.seeAll'), onPress: openActivities } }
              : {})}
          />
        )}
      </>
    ),
    [
      chartWidth,
      empty,
      goal,
      hasHistory,
      loading,
      locale,
      onSummaryLayout,
      openActivities,
      retrySummary,
      streak,
      summary,
      summaryQuery.error,
      summaryQuery.isError,
      t,
      todaySeconds,
      units,
      visible.length,
      weekWorkouts,
    ],
  );

  const listEmpty = useMemo(
    () =>
      empty ? (
        <EmptyState
          title={t('home.emptyTitle')}
          message={t('home.emptyMessage')}
          icon="target"
          actionLabel={t('homeTab.browseRoutines')}
          onAction={openWorkoutTab}
        />
      ) : loading ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={4} />
        </View>
      ) : null,
    [empty, loading, openWorkoutTab, t],
  );
  const contentContainerStyle = useMemo(() => ({ paddingBottom: bottomSpace }), [bottomSpace]);
  const listStyle = useMemo(() => ({ backgroundColor: theme.colors.background }), [theme]);

  return (
    <>
      <ScreenHeader
        title={profileName ? t('homeTab.hi', { name: firstName(profileName) }) : t('homeTab.today')}
      />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'settings', onPress: openSettings, t, label: 'homeTab.settings' })}
      </HeaderToolbar>

      <FlashList
        {...SCROLL_INSETS}
        // Keyed by locale: a card phrases its metadata with `tr()`, and its memo would keep the
        // old language until the row recycled.
        key={locale}
        data={visible}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={units}
        contentContainerStyle={contentContainerStyle}
        refreshControl={
          <ThemedRefreshControl refreshing={recentQuery.isFetching} onRefresh={refresh} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={listStyle}
      />
      {/* No resume pill here: the tab bar's accessory owns it, for every tab. Home used to
          mount its own, and both drew at once. One owner, and it is the one that is not a
          scene. */}
    </>
  );
}

/* ------------------------------------------------------------------ summary -- */

/**
 * The weekly block: the week's time against the last, four metrics, six-week load, kind mix.
 *
 * `chartWidth` arrives from an `onLayout` on the container, which is why the first pass
 * renders a spacer instead of the chart: `BarChart` computes path geometry in JS and
 * needs a real width, and passing 0 would draw a chart at zero width that then snaps.
 *
 * Memoised, with `t` as a prop so a language change still reaches it.
 */
const HomeSummary = memo(function HomeSummary({
  summary,
  units,
  chartWidth,
  t,
}: {
  summary: TrainingSummary;
  units: UnitSystem;
  chartWidth: number;
  t: Translate;
}) {
  const theme = useAppTheme();
  const week = summary.weeks.at(-1);
  const previous = summary.weeks.at(-2);

  // The last six weeks, oldest on the left. `WeekSummary.label` is "Sep 1", which is what a
  // weekly bar wants: labelling by weekday: as this did: puts "Mon" under all six bars,
  // because every week in the array starts on the same weekday.
  const bars: BarPoint[] = useMemo(
    () =>
      summary.weeks.slice(-6).map((w, index, all) => ({
        label: index === all.length - 1 ? t('tabsHome.nowBar') : w.label,
        value: Math.round(w.durationSeconds / 60),
        emphasised: index === all.length - 1,
        detail: t('activities.session', { count: w.workouts }),
      })),
    [summary.weeks, t],
  );

  const slices: DistributionSlice[] = useMemo(() => {
    const byKind = new Map<Activity['kind'], number>();
    for (const w of summary.weeks) {
      for (const [kind, count] of Object.entries(w.byKind) as Array<[Activity['kind'], number]>) {
        byKind.set(kind, (byKind.get(kind) ?? 0) + count);
      }
    }
    // Sessions, not minutes: `byKind` is a count the summary already computed. Turning it
    // into minutes would need the rows, and the rows are a different query: a donut that
    // disagrees with the list under it is worse than a donut measuring something simpler.
    return KIND_ORDER.filter((kind) => (byKind.get(kind) ?? 0) > 0).map((kind) => ({
      kind,
      value: byKind.get(kind) ?? 0,
    }));
  }, [summary.weeks]);

  const formatMinutes = useCallback((v: number) => t('tabsHome.minutesShort', { value: v }), [t]);
  const formatSessions = useCallback((v: number) => t('activities.session', { count: v }), [t]);

  const delta = deltaPercent(week?.durationSeconds ?? 0, previous?.durationSeconds ?? 0);
  const trend: Trend | undefined =
    delta === null
      ? undefined
      : {
          delta: t('homeTab.deltaAgainstLastWeek', { delta: `${delta >= 0 ? '+' : ''}${delta}` }),
          direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        };
  const volume = week?.volumeKg ?? 0;
  const distance = week?.distanceMeters ?? 0;

  return (
    <Stack gap="lg">
      <Card>
        <StatTile
          emphasis="hero"
          value={formatDurationCompact(week?.durationSeconds ?? 0)}
          label={t('home.thisWeek')}
          {...(trend ? { trend } : {})}
        />
        <View style={styles.divider}>
          <Divider />
        </View>
        <MetricGrid columns={2}>
          <StatTile label={t('home.sessions')} value={`${week?.workouts ?? 0}`} />
          <StatTile
            label={t('home.distance')}
            value={distance > 0 ? formatDistance(distance, units, 1) : t('common.noValue')}
          />
          <StatTile
            label={t('home.volume')}
            value={volume > 0 ? compactNumber(volume) : t('common.noValue')}
            {...(volume > 0 ? { unit: 'kg' } : {})}
          />
          <StatTile
            label={t('home.calories')}
            value={compactNumber(Math.round(week?.caloriesKcal ?? 0))}
            unit="kcal"
          />
        </MetricGrid>
      </Card>

      <Card>
        <SectionHeader
          title={t('home.trainingLoad')}
          eyebrow={t('home.lastSixWeeks')}
          style={styles.chartTitle}
        />
        {chartWidth > CARD_PADDING * 2 ? (
          <BarChart
            points={bars}
            theme={theme}
            width={chartWidth - CARD_PADDING * 2}
            height={CHART_HEIGHT}
            format={formatMinutes}
            showValueForLast
          />
        ) : (
          <View style={styles.chartSpacer} />
        )}
      </Card>

      {slices.length > 0 ? (
        <Card>
          <SectionHeader
            title={t('homeTab.mix')}
            eyebrow={t('tabsHome.mixEyebrow', { count: summary.rangeWeeks })}
          />
          <ActivityDistribution
            slices={slices}
            theme={theme}
            formatValue={formatSessions}
            centerLabel={`${summary.totals.workouts}`}
            centerSublabel={t('profileScreen.sessionWord', { count: summary.totals.workouts })}
          />
        </Card>
      ) : null}
    </Stack>
  );
});

/* ------------------------------------------------------------------ helpers -- */

/**
 * The line under the greeting.
 *
 * Phrased so the sentence is true in every state: no history, history but today off,
 * mid-streak: rather than a template that prints "0 day streak" on a fresh install.
 * That string is the most demoralising thing a fitness app can say to someone who has
 * just opened it for the first time.
 */
function headlineFor(currentStreak: number, summary: TrainingSummary | undefined, t: Translate): string {
  if (!summary || !summary.hasAnyHistory) return t('homeTab.headlineFirst');
  if (currentStreak === 0) return t('homeTab.headlineReady');
  if (currentStreak === 1) return t('homeTab.headlineDayOne');
  return t('homeTab.headlineStreak', { count: currentStreak });
}

function greeting(t: Translate): string {
  const hour = new Date().getHours();
  if (hour < 5) return t('homeTab.greetLate');
  if (hour < 12) return t('home.eyebrowMorning');
  if (hour < 18) return t('home.eyebrowAfternoon');
  return t('home.eyebrowEvening');
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/**
 * Percentage change, or `null` when there is nothing to compare against.
 *
 * A zero previous week returns null rather than `Infinity` or 100: "+∞%" is not a
 * sentence, and claiming "+100%" when last week had no training at all implies a
 * comparison that did not happen.
 */
function deltaPercent(current: number, previous: number): number | null {
  if (previous <= 0 || current <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  tiles: { paddingTop: spacing.xs },
  summary: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  recentHeader: { paddingHorizontal: screenGutter },
  cardCell: { paddingHorizontal: screenGutter, paddingBottom: spacing.md },
  skeleton: { paddingHorizontal: screenGutter },
  divider: { marginVertical: spacing.lg },
  chartTitle: { marginBottom: spacing.lg },
  chartSpacer: { height: CHART_HEIGHT },
});
