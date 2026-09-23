/**
 * Home: the daily answer to "did I train, and am I getting anywhere?"
 *
 * ## Order, which is the whole design
 *
 * Four questions, answered top to bottom in the order people ask them: *did I train*
 * (ring against goal, streak), *how much this week* (the metric grid), *what did I do*
 * (recent sessions), *is it working* (the six-week load chart, then the mix). The donut
 * is last and smallest on purpose: it is interesting once a month and noise the rest
 * of the time.
 *
 * ## Why the FlashList owns the scroll
 *
 * There is no outer `ScrollView`. The collapsing header reads the list's own scroll
 * offset, and a wrapper cannot reach inside a list the caller owns: while nesting a
 * virtualised list in a scroll view defeats the virtualisation. So the header is an
 * absolutely-positioned sibling overlay, and everything else: hero, summary cards,
 * rows: is list content: the hero scrolls away, the cards scroll in, and the whole
 * screen stays one recycling surface. `ListHeaderComponent` is where that content goes,
 * which also means it is measured once and recycled as a unit rather than per row.
 *
 * ## One read, two numbers
 *
 * The recent list is fetched at 60 rows and used twice: the top 7 render, and all 60
 * feed the current streak. Fetching a second, longer list purely to count consecutive
 * days would be a second pass over the same table for one integer, and capping the
 * streak query at 7 would silently report a 12-day streak as 7: wrong in exactly the
 * direction the user is proud of.
 */
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useTabContentBottom } from '@/ui/insets';

import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { StatTile, TagRow, type Tag } from '@/ui/display';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { LiveClock } from '@/ui/LiveClock';
import { ActivityRow } from '@/ui/rows';
import { Card, Divider, Row, Stack } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { MetricLabel, Txt } from '@/ui/Text';
import { BarChart, type BarPoint } from '@/ui/charts/BarChart';
import { ActivityDistribution, type DistributionSlice } from '@/ui/charts/ActivityDistribution';
import { ProgressRing } from '@/ui/charts/ProgressRing';
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
import { tr } from '@/i18n/tr';
import {
  compactNumber,
  formatDurationCompact,
  formatDistance,
  type UnitSystem,
} from '@/utils/format';
import { activitySummary } from '@/ui/display';

/** Rows actually shown. The fetched set is longer: see the header note on streaks. */
const RECENT_VISIBLE = 7;
const RECENT_FETCHED = 60;

/** Clearance for the floating tab bar plus the live-session pill above it. */

/** `Card`'s default `padding='lg'`, subtracted from any chart that must fit inside one. */
const CARD_PADDING = spacing.lg;

export default function HomeScreen() {
  const { t } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const [chartWidth, onChartLayout] = useMeasuredWidth();

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

  const loading = summaryQuery.isPending && !summaryQuery.isError;
  // `weeks` is oldest-first, so the current week is the *last* entry. See the contract in
  // `useProgress.ts`: reading index 0 instead shows a week four (or seven) ago as today,
  // with numbers plausible enough that nothing looks broken.
  const week = summary?.weeks.at(-1);
  const remaining = goal - (week?.workouts ?? 0);
  const ratio = goal > 0 ? Math.min(1, (week?.workouts ?? 0) / goal) : 0;

  const openActivity = useCallback(
    (id: string) => router.push(routes.activityDetail(id)),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Activity }) => {
      const display = activitySummary(item, units, showSpeed);
      return (
        <ActivityRow
          activity={item}
          theme={theme}
          headline={display.headline}
          meta={display.meta}
          onPress={() => openActivity(item.id)}
        />
      );
    },
    [openActivity, showSpeed, theme, units],
  );

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  const refresh = useCallback(() => {
    void recentQuery.refetch();
    void summaryQuery.refetch();
  }, [recentQuery, summaryQuery]);

  const empty = summary !== undefined && !summary.hasAnyHistory && !loading;
  const openSettings = useCallback(() => router.push(routes.settings()), [router]);
  const heroTags = useMemo<Tag[]>(
    () => [
      remaining > 0
        ? { key: 'goal', label: t('homeTab.toWeeklyGoal', { count: remaining }), tone: 'neutral' }
        : { key: 'goal', label: t('homeTab.weeklyGoalMet'), tone: 'accent' },
    ],
    [remaining, t],
  );

  const listHeader = (
    <>
      {/* The first content block: what the old collapsing hero said, as structured pieces. A
          streak worth naming is a stat; anything less is the sentence that encourages. */}
      <Stack gap="md" style={styles.hero}>
        <Txt variant="micro" tone="faint" uppercase tracking={1.1}>
          {greeting()}
        </Txt>
        {streak.current >= 2 ? (
          <StatTile
            emphasis="hero"
            value={`${streak.current}`}
            unit={t('homeHero.streakUnit', { count: streak.current })}
            label={t('homeHero.streakLabel')}
          />
        ) : (
          <Txt variant="headline">{headlineFor(streak.current, summary)}</Txt>
        )}
        {/* Its own component so the per-second tick re-renders two Txt nodes rather than the
            hero and everything the hero is a child of. */}
        <LiveClock />
        {summary?.hasAnyHistory ? <TagRow tags={heroTags} theme={theme} /> : null}
      </Stack>

      <View
        style={{ paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.xl }}
        onLayout={onChartLayout}
      >
        {loading ? (
          <Stack gap="lg">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </Stack>
        ) : summaryQuery.isError ? (
          <ErrorState
            error={summaryQuery.error}
            onRetry={() => void summaryQuery.refetch()}
            compact
          />
        ) : summary ? (
          <HomeSummary
            summary={summary}
            goal={goal}
            ratio={ratio}
            units={units}
            chartWidth={chartWidth}
          />
        ) : null}
      </View>

      {empty ? null : (
        <SectionHeader
          title={t('homeTab.recent')}
          eyebrow={t('homeTab.latestSessions')}
          style={{ paddingHorizontal: screenGutter }}
          {...(visible.length > 0
            ? { action: { label: t('homeTab.seeAll'), onPress: () => router.push(tabHref(1)) } }
            : {})}
        />
      )}
    </>
  );

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
        data={visible}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={units}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        refreshControl={
          <ThemedRefreshControl refreshing={recentQuery.isFetching} onRefresh={refresh} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          empty ? (
            <EmptyState
              title={t('home.emptyTitle')}
              message={t('home.emptyMessage')}
              icon="target"
              actionLabel={t('homeTab.browseRoutines')}
              onAction={() => router.push(tabHref(2))}
            />
          ) : loading ? (
            <View style={{ paddingHorizontal: screenGutter }}>
              <SkeletonList rows={4} />
            </View>
          ) : null
        }
        style={{ backgroundColor: theme.colors.background }}
      />
      {/* No resume pill here: the tab bar's accessory owns it, for every tab. Home used to
          mount its own, and both drew at once. One owner, and it is the one that is not a
          scene. */}
    </>
  );
}

/* ------------------------------------------------------------------ summary -- */

/**
 * The weekly block: goal ring, four metrics, six-week load, kind mix.
 *
 * `chartWidth` arrives from an `onLayout` on the container, which is why the first pass
 * renders a spacer instead of the chart: `BarChart` computes path geometry in JS and
 * needs a real width, and passing 0 would draw a chart at zero width that then snaps.
 */
function HomeSummary({
  summary,
  goal,
  ratio,
  units,
  chartWidth,
}: {
  summary: TrainingSummary;
  goal: number;
  ratio: number;
  units: UnitSystem;
  chartWidth: number;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const week = summary.weeks.at(-1);
  const previous = summary.weeks.at(-2);

  // The last six weeks, oldest on the left. `WeekSummary.label` is "Sep 1", which is what a
  // weekly bar wants: labelling by weekday: as this did: puts "Mon" under all six bars,
  // because every week in the array starts on the same weekday.
  const bars: BarPoint[] = useMemo(
    () =>
      summary.weeks.slice(-6).map((w, index, all) => ({
        label: index === all.length - 1 ? 'Now' : w.label,
        value: Math.round(w.durationSeconds / 60),
        emphasised: index === all.length - 1,
        detail: `${w.workouts} ${w.workouts === 1 ? 'session' : 'sessions'}`,
      })),
    [summary.weeks],
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

  const delta = deltaPercent(week?.durationSeconds ?? 0, previous?.durationSeconds ?? 0);

  return (
    <Stack gap="lg">
      <Card>
        <Row gap="lg" align="center">
          <ProgressRing
            progress={ratio}
            theme={theme}
            size={90}
            label={`${week?.workouts ?? 0}`}
            sublabel={t('homeTab.ofGoal', { goal })}
          />
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <MetricLabel label={t('home.thisWeek')} />
            <Txt variant="title" numberOfLines={1}>
              {formatDurationCompact(week?.durationSeconds ?? 0)}
            </Txt>
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {delta === null
                ? goal - (week?.workouts ?? 0) > 0
                  ? t('homeTab.moreToGoal', { count: goal - (week?.workouts ?? 0) })
                  : t('homeTab.goalComplete')
                : t('homeTab.deltaAgainstLastWeek', {
                    delta: `${delta >= 0 ? '+' : ''}${delta}`,
                  })}
            </Txt>
          </Stack>
        </Row>

        <View style={{ marginTop: spacing.lg }}>
          <Divider />
        </View>

        <View style={{ paddingTop: spacing.lg }}>
          <Row gap="lg">
            <MetricCell label={t('home.sessions')} value={`${week?.workouts ?? 0}`} />
            <MetricCell
              label={t('home.distance')}
              value={
                (week?.distanceMeters ?? 0) > 0
                  ? formatDistance(week?.distanceMeters ?? 0, units, 1)
                  : '-'
              }
            />
          </Row>
          <Row gap="lg" style={{ marginTop: spacing.md }}>
            <MetricCell
              label={t('home.volume')}
              value={(week?.volumeKg ?? 0) > 0 ? `${compactNumber(week?.volumeKg ?? 0)} kg` : '-'}
            />
            <MetricCell
              label={t('home.calories')}
              value={compactNumber(Math.round(week?.caloriesKcal ?? 0))}
            />
          </Row>
        </View>
      </Card>

      <Card>
        <SectionHeader
          title={t('home.trainingLoad')}
          eyebrow={t('home.lastSixWeeks')}
          style={{ marginBottom: spacing.lg }}
        />
        {chartWidth > CARD_PADDING * 2 ? (
          <BarChart
            points={bars}
            theme={theme}
            width={chartWidth - CARD_PADDING * 2}
            height={140}
            format={(v) => `${v}m`}
            showValueForLast
          />
        ) : (
          <View style={{ height: 140 }} />
        )}
      </Card>

      {slices.length > 0 ? (
        <Card>
          <SectionHeader
            title={t('homeTab.mix')}
            eyebrow={`Sessions over ${summary.rangeWeeks} weeks`}
            style={{ marginBottom: spacing.md }}
          />
          <ActivityDistribution
            slices={slices}
            theme={theme}
            formatValue={(v) => `${v} ${v === 1 ? 'session' : 'sessions'}`}
            centerLabel={`${summary.totals.workouts}`}
            centerSublabel="sessions"
          />
        </Card>
      ) : null}
    </Stack>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="xxs" style={{ flex: 1, minWidth: 0 }}>
      <MetricLabel label={label} />
      <Txt variant="subhead" numberOfLines={1}>
        {value}
      </Txt>
    </Stack>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * The streak line under the greeting.
 *
 * Phrased so the sentence is true in every state: no history, history but today off,
 * mid-streak: rather than a template that prints "0 day streak" on a fresh install.
 * That string is the most demoralising thing a fitness app can say to someone who has
 * just opened it for the first time.
 */
function headlineFor(currentStreak: number, summary: TrainingSummary | undefined): string {
  if (!summary || !summary.hasAnyHistory) return tr('homeTab.headlineFirst');
  if (currentStreak === 0) return tr('homeTab.headlineReady');
  if (currentStreak === 1) return tr('homeTab.headlineDayOne');
  return tr('homeTab.headlineStreak', { count: currentStreak });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return tr('homeTab.greetLate');
  if (hour < 12) return tr('home.eyebrowMorning');
  if (hour < 18) return tr('home.eyebrowAfternoon');
  return tr('home.eyebrowEvening');
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
});
