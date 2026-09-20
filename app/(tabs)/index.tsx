/**
 * Home — the daily answer to "did I train, and am I getting anywhere?"
 *
 * ## Order, which is the whole design
 *
 * Four questions, answered top to bottom in the order people ask them: *did I train*
 * (ring against goal, streak), *how much this week* (the metric grid), *what did I do*
 * (recent sessions), *is it working* (the six-week load chart, then the mix). The donut
 * is last and smallest on purpose — it is interesting once a month and noise the rest
 * of the time.
 *
 * ## Why the FlashList owns the scroll
 *
 * There is no outer `ScrollView`. The collapsing header reads the list's own scroll
 * offset, and a wrapper cannot reach inside a list the caller owns — while nesting a
 * virtualised list in a scroll view defeats the virtualisation. So the header is an
 * absolutely-positioned sibling overlay, and everything else — hero, summary cards,
 * rows — is list content: the hero scrolls away, the cards scroll in, and the whole
 * screen stays one recycling surface. `ListHeaderComponent` is where that content goes,
 * which also means it is measured once and recycled as a unit rather than per row.
 *
 * ## One read, two numbers
 *
 * The recent list is fetched at 60 rows and used twice: the top 7 render, and all 60
 * feed the current streak. Fetching a second, longer list purely to count consecutive
 * days would be a second pass over the same table for one integer, and capping the
 * streak query at 7 would silently report a 12-day streak as 7 — wrong in exactly the
 * direction the user is proud of.
 */
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarAction, CollapsibleHeader, CollapsibleHero, useScreenHeaderScroll } from '@/ui/Screen';
import { ActivityRow } from '@/ui/rows';
import { Badge, Card, Divider, Row, SectionHeader, Stack } from '@/ui/layout';
import { MetricLabel, Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { Button } from '@/ui/Button';
import { BarChart, type BarPoint } from '@/ui/charts/BarChart';
import { ActivityDistribution, type DistributionSlice } from '@/ui/charts/ActivityDistribution';
import { ProgressRing } from '@/ui/charts/ProgressRing';
import { useMeasuredWidth } from '@/ui/charts/Sparkline';
import { EmptyState, ErrorState, SkeletonCard, SkeletonList, ThemedRefreshControl } from '@/ui/states';
import { useRecentActivities } from '@/queries/useActivities';
import { useTrainingSummary, type TrainingSummary } from '@/queries/useProgress';
import { useSettings } from '@/settings/hooks';
import { activityDisplay, KIND_ORDER } from '@/domain/display';
import { computeStreak } from '@/domain/logic';
import type { Activity } from '@/domain/types';
import { routes, tabHref } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import {
  compactNumber,
  formatDurationCompact,
  formatDistance,
  type UnitSystem,
} from '@/utils/format';

/** Rows actually shown. The fetched set is longer — see the header note on streaks. */
const RECENT_VISIBLE = 7;
const RECENT_FETCHED = 60;

/** Clearance for the floating tab bar plus the live-session pill above it. */
const BOTTOM_SPACE = 132;

/** `Card`'s default `padding='lg'`, subtracted from any chart that must fit inside one. */
const CARD_PADDING = spacing.lg;

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const header = useScreenHeaderScroll();
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
  // `useProgress.ts` — reading index 0 instead shows a week four (or seven) ago as today,
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
      const display = activityDisplay(item, units, showSpeed);
      return (
        <ActivityRow
          activity={item}
          theme={theme}
          headline={display.headline}
          subtitle={display.subtitle}
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

  const listHeader = (
    <>
      <CollapsibleHero
        header={header}
        eyebrow={greeting()}
        title={headlineFor(streak.current, summary)}
      >
        {summary?.hasAnyHistory ? (
          <Row gap="sm" style={{ marginTop: spacing.md }}>
            <Badge
              label={remaining > 0 ? `${remaining} to weekly goal` : 'Weekly goal met'}
              tone={remaining > 0 ? 'neutral' : 'success'}
            />
            {streak.current >= 2 ? (
              <Badge
                label={`${streak.current} days`}
                tone="accent"
                icon={<Icon name="flame" size={12} color={theme.colors.accent} />}
              />
            ) : null}
          </Row>
        ) : null}
      </CollapsibleHero>

      <View
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl }}
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
          title="Recent"
          eyebrow="Latest sessions"
          style={{ paddingHorizontal: spacing.lg }}
          action={
            visible.length > 0 ? (
              <Button
                label="See all"
                variant="quiet"
                size="sm"
                onPress={() => router.push(tabHref(1))}
              />
            ) : null
          }
        />
      )}
    </>
  );

  return (
    <View style={styles.root}>
      <CollapsibleHeader
        header={header}
        title={profileName ? `Hi ${firstName(profileName)}` : 'Today'}
        right={
          <BarAction
            icon="settings"
            label="Settings"
            onPress={() => router.push(routes.settings())}
          />
        }
      />

      <FlashList
        data={visible}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={units}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: BOTTOM_SPACE }}
        progressViewOffset={insets.top + 52}
        refreshControl={
          <ThemedRefreshControl refreshing={recentQuery.isFetching} onRefresh={refresh} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          empty ? (
            <EmptyState
              title="No training yet"
              message="Pick a routine and go lift something. Kinetiq keeps score from the first set you finish."
              icon="target"
              actionLabel="Browse routines"
              onAction={() => router.push(tabHref(2))}
            />
          ) : loading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonList rows={4} />
            </View>
          ) : null
        }
        style={{ backgroundColor: theme.colors.background }}
      />
      {/* No resume pill here: `TabBarWithPill` owns it, for every tab. Home used to mount
          its own, and since the tab bar renders behind this scene rather than inside it,
          both drew at once — two pills overlapping on the one screen where that was
          visible. One owner, and it is the one that is not a scene. */}
    </View>
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
  const theme = useAppTheme();
  const week = summary.weeks.at(-1);
  const previous = summary.weeks.at(-2);

  // The last six weeks, oldest on the left. `WeekSummary.label` is "Sep 1", which is what a
  // weekly bar wants: labelling by weekday — as this did — puts "Mon" under all six bars,
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
    // into minutes would need the rows, and the rows are a different query — a donut that
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
            sublabel={`of ${goal}`}
          />
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <MetricLabel label="This week" />
            <Txt variant="title" numberOfLines={1}>
              {formatDurationCompact(week?.durationSeconds ?? 0)}
            </Txt>
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {delta === null
                ? goal - (week?.workouts ?? 0) > 0
                  ? `${goal - (week?.workouts ?? 0)} more to hit your goal`
                  : 'Weekly goal complete'
                : `${delta >= 0 ? '+' : ''}${delta}% against last week`}
            </Txt>
          </Stack>
        </Row>

        <View style={{ marginTop: spacing.lg }}>
          <Divider />
        </View>

        <View style={{ paddingTop: spacing.lg }}>
          <Row gap="lg">
            <MetricCell label="Sessions" value={`${week?.workouts ?? 0}`} />
            <MetricCell
              label="Distance"
              value={
                (week?.distanceMeters ?? 0) > 0
                  ? formatDistance(week?.distanceMeters ?? 0, units, 1)
                  : '—'
              }
            />
          </Row>
          <Row gap="lg" style={{ marginTop: spacing.md }}>
            <MetricCell
              label="Volume"
              value={(week?.volumeKg ?? 0) > 0 ? `${compactNumber(week?.volumeKg ?? 0)} kg` : '—'}
            />
            <MetricCell label="Calories" value={compactNumber(Math.round(week?.caloriesKcal ?? 0))} />
          </Row>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Training load" eyebrow="Last 6 weeks" style={{ marginBottom: spacing.lg }} />
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
            title="Mix"
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
 * Phrased so the sentence is true in every state — no history, history but today off,
 * mid-streak — rather than a template that prints "0 day streak" on a fresh install.
 * That string is the most demoralising thing a fitness app can say to someone who has
 * just opened it for the first time.
 */
function headlineFor(currentStreak: number, summary: TrainingSummary | undefined): string {
  if (!summary || !summary.hasAnyHistory) return 'Start your first session';
  if (currentStreak === 0) return 'Ready when you are';
  if (currentStreak === 1) return 'Day one of something';
  return `${currentStreak} days in a row`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late session';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
  root: { flex: 1 },
});
