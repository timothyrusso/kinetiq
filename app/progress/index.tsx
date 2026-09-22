/**
 * Progress: what a stretch of training actually looked like.
 *
 * ## Two controls, and what each one governs
 *
 * The range chips pick the window; the measure chips pick which column of that same
 * window the line draws. Both are local state, deliberately: `useTrainingSummary(n)` keys
 * its cache entry on `n`, so Home (which asks for 8 weeks) and this screen get separate
 * entries instead of fighting over one, and switching to "12 months" here does not
 * silently change what Home computes. It also means three rapid taps across three ranges
 * fire three queries that each land in their own cache slot, arriving in any order without
 * one overwriting another: which is what a key-per-window cache is for, and why there is
 * no debounce or pending-value juggling in this file.
 *
 * Neither control touches the heatmap (fixed at 26 weeks: see `useTrainingHeatmap`) or the
 * records. A record is a fact about all of history, not about a window, so that section's
 * eyebrow says "All time" rather than letting a chip imply otherwise.
 *
 * ## One line, three measures
 *
 * Duration, distance and volume are all columns of the same `WeekSummary` the query already
 * returned. Three stacked charts would need three scrolls to compare; one chart with a
 * measure switch compares in one glance and costs no extra reads. Each measure owns its own
 * zero policy, so it lives in the `MEASURES` table rather than in three branches.
 *
 * ## Week order, spelled out once
 *
 * `useTrainingSummary` returns weeks **oldest-first**, which is both what the charts want
 * (left to right is time, so the array maps onto the x-axis with no adaptation) and what
 * `slice(-6)` means. "This week" is therefore `weeks.at(-1)`. Getting this backwards fails
 * silently: the numbers stay plausible, they are just four weeks out of date: so the
 * contract is stated in `useProgress.ts` where the array is built, and repeated here only to
 * say that nothing in this file reverses it.
 *
 * ## Charts need a measured width
 *
 * Every chart here computes its path geometry in JavaScript, so it has to be handed a real
 * width. The card is measured with `onLayout`, and the chart gets that width minus the
 * card's own horizontal padding. Before layout the measurement is 0, and drawing a chart at
 * 0 renders one that then snaps to size mid-animation; reserving the final height instead
 * keeps the card still.
 *
 * ## Empty, twice over
 *
 * `hasAnyHistory` separates "you have never logged a workout" from "not in this window". The
 * first is onboarding and needs a button that creates something. The second is a factual
 * sentence about four quiet weeks whose remedy is a longer range: telling someone to "start
 * a workout" when they have twenty behind them reads as a bug. So they are two different
 * states, not one with conditional copy.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenHeader, ScreenScroll } from '@/ui/Screen';
import { MetaLine } from '@/ui/display';
import { Card, Divider, MetricGrid, Row, Stack } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { Chip } from '@/ui/controls/Chip';
import { IconTile } from '@/ui/icons';
import { ListRow } from '@/ui/rows';
import { MetricLabel, Txt } from '@/ui/Text';
import { EmptyState, ErrorState, SkeletonCard, SkeletonList } from '@/ui/states';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { ActivityDistribution, type DistributionSlice } from '@/ui/charts/ActivityDistribution';
import { HeatmapCalendar, type HeatmapDay } from '@/ui/charts/HeatmapCalendar';
import { useMeasuredWidth } from '@/ui/charts/useMeasuredWidth';
import {
  usePersonalRecords,
  useTrainingHeatmap,
  useTrainingSummary,
  type TrainingHeatmap,
  type TrainingSummary,
  type WeekSummary,
} from '@/queries/useProgress';
import { RECORD_LABEL, formatRecordValue } from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings';
import { routes, tabHref, tabIndexOf } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { dayKey } from '@/domain/logic';
import { KIND_ORDER } from '@/domain/display';
import {
  formatDistance,
  formatDurationCompact,
  formatShortDate,
  formatWeight,
  trimNumber,
  type UnitSystem,
  weightUnit,
} from '@/utils/format';
import type { ActivityKind, PersonalRecord } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import type { TKey, TVars } from '@/i18n';

/** Weeks per option. The summary is computed per week, so the options are weeks. */
const RANGES = [
  { weeks: 4, label: 'progress.range4' },
  { weeks: 12, label: 'progress.range12' },
  { weeks: 26, label: 'progress.range26' },
  { weeks: 52, label: 'progress.range52' },
] as const satisfies readonly { weeks: number; label: TKey }[];

type RangeWeeks = (typeof RANGES)[number]['weeks'];
const DEFAULT_RANGE: RangeWeeks = 12;

/** What the line draws. All three are already columns of `WeekSummary`. */
type Measure = 'duration' | 'distance' | 'volume';

/** Below this many non-zero weeks a line is an anecdote, not a trend. See `MeasureChart`. */
const MIN_TREND_POINTS = 2;

/** Reserved before measurement, matching `TrendChart`'s own default height. */
const CHART_HEIGHT = 184;

export default function ProgressScreen() {
  const { t } = useT();
  const router = useRouter();
  const theme = useAppTheme();

  const units = useSettings((s) => s.unitSystem);
  const goal = useSettings((s) => s.weeklyGoalWorkouts);

  const [rangeWeeks, setRangeWeeks] = useState<RangeWeeks>(DEFAULT_RANGE);
  const [measure, setMeasure] = useState<Measure>('duration');

  const summaryQuery = useTrainingSummary(rangeWeeks);
  const heatmapQuery = useTrainingHeatmap();
  const recordsQuery = usePersonalRecords();

  const [chartWidth, onChartLayout] = useMeasuredWidth();

  const summary = summaryQuery.data;
  // `isPending` alone would flash skeletons on every range change, because a brand-new
  // cache key has no data even when the *previous* key's data is still on screen. Keeping
  // the old numbers up while the new window loads is both calmer and honest: they are the
  // right numbers for the range that was on screen a moment ago.
  const showSkeleton = summaryQuery.isPending && summary === undefined;

  const openTab = useCallback(
    (index: number) => {
      // A `replace` onto a tab, not a push. This screen sits on a stack; pushing
      // `/exercises` would put a second copy of the tab bar on top of the one the user is
      // already standing on.
      router.replace(tabHref(index));
    },
    [router],
  );

  return (
    <>
      <ScreenHeader title={t('progress.title')} />
      <ScreenScroll gutter={false} contentContainerStyle={styles.content}>
        <Stack gap="xxl" style={styles.body}>
          <MetaLine items={[{ icon: 'calendar', label: rangeLabel(rangeWeeks, t) }]} theme={theme} />
          <View style={styles.chipRow}>
            {RANGES.map((option) => (
              <Chip
                key={option.weeks}
                label={t(option.label)}
                size="sm"
                selected={option.weeks === rangeWeeks}
                onPress={() => setRangeWeeks(option.weeks)}
              />
            ))}
          </View>

          {showSkeleton ? (
            <Stack gap="lg">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonList rows={3} />
            </Stack>
          ) : summaryQuery.isError && summary === undefined ? (
            // History lives in the local database, so a failure here is a read failure
            // rather than a connection one: the copy has to say that, or someone waits
            // for a signal that was never the problem.
            <ErrorState
              error={summaryQuery.error}
              onRetry={() => void summaryQuery.refetch()}
              title={t('progress.readError')}
            />
          ) : summary && !summary.hasAnyHistory ? (
            <EmptyState
              icon="trendUp"
              title={t('progress.emptyTitle')}
              message={t('progress.emptyMessage')}
              actionLabel={t('progress.startWorkout')}
              onAction={() => openTab(tabIndexOf('workout'))}
              secondaryLabel={t('progress.browseLibrary')}
              onSecondary={() => openTab(tabIndexOf('exercises'))}
            />
          ) : summary ? (
            <>
              <TotalsCard summary={summary} units={units} goal={goal} />

              <View>
                <SectionHeader title={t('progress.trend')} eyebrow={t('progress.weekByWeek')} />
                <Card>
                  <View style={styles.chipRow}>
                    <Chip
                      label={t('progress.time')}
                      size="sm"
                      selected={measure === 'duration'}
                      onPress={() => setMeasure('duration')}
                    />
                    <Chip
                      label={t('progress.distance')}
                      size="sm"
                      selected={measure === 'distance'}
                      onPress={() => setMeasure('distance')}
                    />
                    <Chip
                      label={t('progress.volume')}
                      size="sm"
                      selected={measure === 'volume'}
                      onPress={() => setMeasure('volume')}
                    />
                  </View>
                  {/* Measured *inside* the card, so the chart is handed its own real
                      width directly. Subtracting a hard-coded card padding from the
                      outer width would quietly go wrong the day the card's padding
                      changed: the layout event already knows the answer. */}
                  <View onLayout={onChartLayout}>
                    <MeasureChart
                      summary={summary}
                      measure={measure}
                      width={chartWidth}
                      units={units}
                    />
                  </View>
                </Card>
              </View>

              <DistributionCard summary={summary} />

              <View>
                <SectionHeader
                  title={t('progress.consistency')}
                  eyebrow={t('progress.lastSixMonths')}
                />
                <ConsistencyCard
                  heatmap={heatmapQuery.data}
                  loading={heatmapQuery.isPending && heatmapQuery.data === undefined}
                  error={heatmapQuery.isError}
                  errorValue={heatmapQuery.error}
                  onRetry={() => void heatmapQuery.refetch()}
                />
              </View>

              <View>
                <SectionHeader
                  title={t('progress.personalRecords')}
                  eyebrow={t('progress.allTime')}
                  counter={recordsQuery.data?.length}
                />
                <RecordsCard
                  records={recordsQuery.data}
                  loading={recordsQuery.isPending && recordsQuery.data === undefined}
                  error={recordsQuery.isError}
                  errorValue={recordsQuery.error}
                  units={units}
                  onRetry={() => void recordsQuery.refetch()}
                />
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Divider inset={spacing.sm} />
                <Txt
                  variant="micro"
                  tone="faint"
                  align="center"
                  style={{ marginTop: spacing.lg }}
                >
                  {t('misc.progressPrivacy')}
                </Txt>
              </View>
            </>
          ) : null}
        </Stack>
      </ScreenScroll>
    </>
  );
}

/* ----------------------------------------------------------------- totals -- */

function TotalsCard({
  summary,
  units,
  goal,
}: {
  summary: TrainingSummary;
  units: UnitSystem;
  goal: number;
}) {
  const { t } = useT();
  const totals = summary.totals;

  if (totals.workouts === 0) {
    // History exists: the caller checked `hasAnyHistory`: this window is just empty. The
    // remedy is a wider range, so this says so instead of offering to start a workout.
    return (
      <EmptyState
        compact
        icon="calendar"
        title={t('progress.nothingInRange', {
          range: `${summary.rangeWeeks} ${t('progress.weekWord', { count: summary.rangeWeeks })}`,
        })}
        message={t('progress.nothingInRangeMessage')}
      />
    );
  }

  const perWeek = totals.workouts / Math.max(1, summary.rangeWeeks);
  const target = Math.max(1, goal);
  // The goal is a weekly *rate*, so the shortfall has to be stated against the range as a
  // whole. "24 of 12 weeks": comparing sessions to weeks: is the bug this avoids.
  const shortfall = Math.round(summary.rangeWeeks * target - totals.workouts);
  const cardio = totals.distanceMeters > 0;
  const weighted = totals.volumeKg > 0;

  return (
    <Card>
      <MetricGrid columns={2}>
        <Metric
          label={t('progress.workouts')}
          value={`${totals.workouts}`}
          note={t('progress.perWeek', { value: trimNumber(perWeek, 1) })}
        />
        <Metric
          label={t('progress.time')}
          value={formatDurationCompact(totals.durationSeconds)}
          note={t('progress.hoursTotal', {
            value: trimNumber(totals.durationSeconds / 3600, 1),
          })}
        />
        <Metric
          label={t('progress.distance')}
          value={cardio ? formatDistance(totals.distanceMeters, units) : '-'}
          note={t(cardio ? 'progress.fromCardio' : 'progress.noCardio')}
        />
        <Metric
          label={t('progress.volume')}
          value={weighted ? formatWeight(totals.volumeKg, units) : '-'}
          note={t(weighted ? 'progress.fromStrength' : 'progress.noWeighted')}
        />
      </MetricGrid>

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <Divider />
      </View>

      <Row gap="lg">
        <Metric
          label={t('progress.longestStreak')}
          value={`${summary.bestStreak} ${t('progress.dayWord', { count: summary.bestStreak })}`}
          note={t('progress.anywhereInHistory')}
        />
        <Metric
          label={t('progress.activeDays')}
          value={`${summary.activeDays}`}
          note={t('progress.daysTrained', { percent: Math.round(summary.consistency * 100) })}
        />
      </Row>

      <Txt variant="micro" tone="faint" style={{ marginTop: spacing.lg }}>
        {shortfall <= 0
          ? t('progress.goalMet', {
              target,
              word: t('progress.sessionWord', { count: target }),
            })
          : t('progress.goalShort', {
              target,
              word: t('progress.sessionWord', { count: target }),
              short: shortfall,
              shortWord: t('progress.sessionWord', { count: shortfall }),
            })}
      </Txt>
    </Card>
  );
}

/**
 * The 2-up cell. `note` is required rather than optional: a bare number with no frame is
 * how a dashboard ends up needing a paragraph underneath it to explain what it measures.
 */
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Stack gap="xxs" style={{ flex: 1, minWidth: 0 }}>
      <MetricLabel label={label} />
      <Txt variant="numeralSm" numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="micro" tone="faint" numberOfLines={1}>
        {note}
      </Txt>
    </Stack>
  );
}

/* -------------------------------------------------------------- the line -- */

/**
 * What a measure *is*: how to read it off a week, how to say it out loud, and whether a
 * zero means anything. Keeping the three definitions in one table is what stops the axis
 * format, the tap readout and the empty copy drifting apart the way three parallel
 * conditionals eventually do.
 *
 * `includeZero` differs per measure on purpose. A run-only week genuinely has zero lifting
 * volume, and plotting that as an absent point would hide a true fact; for a distance line,
 * anchoring every series at zero flattens the very variation the line exists to show.
 */
const MEASURES: Record<
  Measure,
  {
    value: (week: WeekSummary) => number;
    format: (value: number, units: UnitSystem) => string;
    includeZero: boolean;
    /** Read aloud under the chart, so units are not the y-axis's private knowledge. */
    caption: (units: UnitSystem) => string;
    emptyLabel: TKey;
  }
> = {
  duration: {
    value: (week) => week.durationSeconds / 60,
    format: (minutes) => `${Math.round(minutes)} min`,
    includeZero: true,
    caption: () => tr('progress.minutesPerWeek'),
    emptyLabel: 'progress.noTrainingInRange',
  },
  distance: {
    value: (week) => week.distanceMeters / 1000,
    format: (km, units) => formatDistance(km * 1000, units),
    includeZero: false,
    caption: () => tr('progress.distancePerWeek'),
    emptyLabel: 'progress.noCardioInRange',
  },
  volume: {
    value: (week) => week.volumeKg,
    format: (kg, units) => formatWeight(kg, units),
    includeZero: false,
    caption: (units) => tr('progress.movedPerWeek', { unit: weightUnit(units) }),
    emptyLabel: 'progress.noWeightedInRange',
  },
};

function MeasureChart({
  summary,
  measure,
  width,
  units,
}: {
  summary: TrainingSummary;
  measure: Measure;
  width: number;
  units: UnitSystem;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const spec = MEASURES[measure];

  const points: TrendPoint[] = useMemo(
    () =>
      // No copy, no reverse: the array is already oldest-first, which is the order a line
      // chart draws left to right. `map` leaves the cached array untouched either way.
      summary.weeks.map((week) => {
        const value = spec.value(week);
        return {
          label: week.label,
          value,
          detail:
            value > 0
              ? `${spec.format(value, units)} · ${week.workouts} ${t('progress.sessionWord', { count: week.workouts })}`
              : `${t('progress.nothingLogged')} · ${week.workouts} ${t('progress.sessionWord', { count: week.workouts })}`,
        };
      }),
    [spec, summary.weeks, t, units],
  );

  // Not measured yet. Reserve the final height so the card does not jump when the real
  // width arrives one layout pass later.
  if (width <= 0) return <View style={{ height: CHART_HEIGHT }} />;

  const plotted = points.filter((point) => point.value > 0).length;
  if (plotted < MIN_TREND_POINTS) {
    // A single point is a fact, not a trend, and a two-point line implies a direction the
    // data does not support. Say the number instead of drawing a shape around it.
    const only = points.findLast((point) => point.value > 0);
    return (
      <EmptyState
        compact
        icon="trendUp"
        title={
          only
            ? `${spec.format(only.value, units)} ${spec.caption(units).toLowerCase()}`
            : t(spec.emptyLabel)
        }
        message={
          only
            ? t('progress.needSecondWeek')
            : t('progress.nothingAcrossRange', {
                range: `${summary.rangeWeeks} ${t('progress.weekWord', { count: summary.rangeWeeks })}`,
              })
        }
      />
    );
  }

  return (
    <>
      <TrendChart
        points={points}
        theme={theme}
        width={width}
        height={CHART_HEIGHT}
        includeZero={spec.includeZero}
        format={(value) => spec.format(value, units)}
        emptyLabel={spec.emptyLabel}
      />
      <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
        {t('misc.oldestLeft', { caption: spec.caption(units) })}
      </Txt>
    </>
  );
}

/* ---------------------------------------------------------- distribution -- */

function DistributionCard({ summary }: { summary: TrainingSummary }) {
  const { t } = useT();
  const theme = useAppTheme();

  const slices: DistributionSlice[] = useMemo(() => {
    const totals = new Map<ActivityKind, number>();
    for (const week of summary.weeks) {
      for (const kind of KIND_ORDER) {
        totals.set(kind, (totals.get(kind) ?? 0) + week.byKind[kind]);
      }
    }
    // Sessions, not minutes. `byKind` is a per-week count the summary already computed;
    // minutes would need the activity rows: a different query, and a second source of
    // truth for one screen. A donut that disagrees with the list beside it is worse than
    // one measuring something simpler and matching it exactly.
    return KIND_ORDER.filter((kind) => (totals.get(kind) ?? 0) > 0).map((kind) => ({
      kind,
      value: totals.get(kind) ?? 0,
    }));
  }, [summary.weeks]);

  if (slices.length === 0) return null;

  return (
    <Card>
      <ActivityDistribution
        slices={slices}
        theme={theme}
        // The bare count, not "23 sessioni": the ring's own sublabel already names the unit,
        // and repeating it in every row squeezed the label column until "Camminata" rendered
        // as "Ca...".
        formatValue={(value) => `${value}`}
        centerLabel={`${summary.totals.workouts}`}
        centerSublabel={t('progress.sessionsSublabel')}
      />
    </Card>
  );
}

/* ----------------------------------------------------------- consistency -- */

function ConsistencyCard({
  heatmap,
  loading,
  error,
  errorValue,
  onRetry,
}: {
  heatmap: TrainingHeatmap | undefined;
  loading: boolean;
  error: boolean;
  errorValue: unknown;
  onRetry: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();

  // A `null` day is a day that has not happened yet. The grid's own convention for that is
  // an empty `date`, which it draws as a dotted placeholder: precisely the right meaning.
  // So nulls become empty-date zeros rather than being dropped: dropping one shifts every
  // later weekday out of its column, and the entire point of a calendar grid is that Monday
  // stays on one line.
  const days: HeatmapDay[] = useMemo(
    () =>
      (heatmap?.weeks ?? []).flatMap((week) =>
        week.days.map((day) => ({
          date: day === null ? '' : dayKey(day.dayStart),
          value: day === null ? 0 : Math.round(day.durationSeconds / 60),
        })),
      ),
    [heatmap],
  );

  if (loading) return <SkeletonCard />;
  if (error)
    return (
      <ErrorState
        error={errorValue}
        onRetry={onRetry}
        title={t('progress.calendarError')}
        compact
      />
    );
  if (days.length === 0) {
    return <EmptyState compact icon="calendar" title={t('progress.nothingToPlot')} />;
  }

  const total = heatmap?.totalWorkouts ?? 0;
  return (
    <Card>
      <HeatmapCalendar
        days={days}
        theme={theme}
        label={t('progress.trainingDays')}
        footer={t('progress.heatmapFooter', {
          count: total,
          word: t('progress.workoutWord', { count: total }),
          weeks: heatmap?.spanWeeks ?? 26,
        })}
      />
    </Card>
  );
}

/* ---------------------------------------------------------------- records -- */

function RecordsCard({
  records,
  loading,
  error,
  errorValue,
  units,
  onRetry,
}: {
  records: PersonalRecord[] | undefined;
  loading: boolean;
  error: boolean;
  errorValue: unknown;
  units: UnitSystem;
  onRetry: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const router = useRouter();

  if (loading) return <SkeletonList rows={3} />;
  if (error)
    return (
      <ErrorState
        error={errorValue}
        onRetry={onRetry}
        title={t('progress.recordsError')}
        compact
      />
    );
  if (!records || records.length === 0)
    return (
      <EmptyState
        compact
        icon="trophy"
        title={t('progress.noRecordsTitle')}
        message={t('progress.noRecordsMessage')}
      />
    );

  return (
    <Card padding="xxs">
      {records.map((record, index) => (
        <ListRow
          // One row per (exercise, kind): someone can hold a heaviest-single and a
          // most-reps record for the same exercise at the same time, and both are worth
          // seeing. An exercise-only key would silently collapse one of them.
          key={`${record.exerciseId}:${record.kind}`}
          theme={theme}
          title={record.exerciseName}
          meta={[
            { icon: 'trophy', label: t(RECORD_LABEL[record.kind]) },
            { icon: 'calendar', label: formatShortDate(record.achievedAt) },
          ]}
          leading={
            <IconTile
              name="trophy"
              color={theme.colors.warning}
              background={theme.colors.warningSoft}
              size={30}
            />
          }
          body={
            <Txt variant="label" tone="muted" numberOfLines={1} style={{ maxWidth: 130 }}>
              {formatRecordValue(record.kind, record.value, units)}
            </Txt>
          }
          showChevron
          onPress={() => router.push(routes.exerciseDetail(record.exerciseId))}
          accessibilityHint={t('progress.opensExercise')}
          // `padding='xxs'` gives the card no vertical rhythm of its own, so rows draw
          // their own separators: the same convention `NavRow` uses inside a grouped card.
          style={index > 0 ? separator(theme.colors.hairline) : undefined}
        />
      ))}
    </Card>
  );
}

/* ----------------------------------------------------------------- helpers -- */

function rangeLabel(weeks: number, t: (key: TKey, vars?: TVars) => string): string {
  const match = RANGES.find((range) => range.weeks === weeks);
  return t('progress.lastRange', {
    label: match ? t(match.label) : `${weeks} ${t('progress.weekWord', { count: weeks })}`,
  });
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing.md },
  body: { paddingHorizontal: screenGutter },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

/**
 * The hairline `NavRow` draws between grouped rows, as a style rather than a prop, because
 * `ListRow` deliberately has no `topDivider` slot: it is a list row, not a settings row.
 *
 * Deliberately outside `StyleSheet.create`: a function in there widens the whole map's
 * inferred value type to `ViewStyle | TextStyle | ImageStyle`, and every plain style beside
 * it stops being assignable to `StyleProp<ViewStyle>`.
 */
function separator(color: string): ViewStyle {
  return { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color };
}
