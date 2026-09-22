/**
 * Activity detail: one session, read back.
 *
 * ## One screen, two shapes
 *
 * A run and a lift share almost no metrics, but splitting them into two routes would mean
 * two headers, two delete flows, two notes editors and two chances to get the offline copy
 * wrong. So the chrome is one screen and only the *body* branches on `activity.kind`:
 * cardio gets map → metric grid → elevation → splits, strength gets summary → volume chart
 * → per-exercise set tables → records. The branch happens once, at the top of the body,
 * where the union actually narrows.
 *
 * ## Absence is rendered, never invented
 *
 * A treadmill run has no route. A session tracked with the watch left at home has no heart
 * rate. Every such gap renders a dash plus one line saying why that is normal: rather than
 * a `0`, a flat line, or a section that quietly vanishes and leaves the user wondering
 * whether the app lost their data. The distinction between "you did zero" and "we did not
 * measure" is the difference between a training log and a lying one. That is also why
 * `Metric` takes `value: string | null` rather than a pre-formatted dash: a caller cannot
 * display a missing number without also deciding what to say about it.
 *
 * ## The map is layered, not switched
 *
 * `RouteMap` draws an SVG trace immediately and puts a native tile view over it only once
 * tiles can genuinely render (see `src/ui/RouteMap.tsx`). This screen's only job is to not
 * claim a route exists when nothing usable was traced, so it asks the same helper the map
 * will itself use: the "is there a route" test then cannot disagree with the drawing.
 *
 * ## Editing notes is a sheet, not an inline field
 *
 * An always-live `TextField` at the bottom of a long detail screen is a keyboard trap: the
 * user scrolls, the field takes focus, the keyboard covers the thing they were reading. A
 * "tap to edit" row that opens a sheet keeps a reading surface a reading surface.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { routes } from '@/navigation/nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { MetaLine } from '@/ui/display';
import { useTransparentHeaderInset } from '@/ui/insets';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { Badge, Card, Divider, MetricGrid, Row, Stack as Column } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { MetricLabel, Txt } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/icons';
import { ActionRow } from '@/ui/rows';
import { ACTIVITY_ICON } from '@/ui/rows';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { RouteMap } from '@/ui/RouteMap';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { useMeasuredWidth } from '@/ui/charts/useMeasuredWidth';
import {
  useActivity,
  useDeleteActivity,
} from '@/queries/useActivities';
// Record wording lives next to the record query, so this screen and the exercise detail
// cannot drift into calling the same record two different things.
import { RECORD_LABEL, formatRecordValue } from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings/hooks';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import { activityDisplay, splitRows, type SplitRow } from '@/domain/display';
import { estimatedOneRepMax } from '@/domain/logic';
import type {
  Activity,
  ActivityKind,
  CardioMetrics,
  StrengthEntry,
  StrengthSet,
} from '@/domain/types';
import { useAppTheme, type Theme } from '@/theme/theme';
import { radius, spacing, screenGutter } from '@/theme/tokens';
import type { UnitSystem } from '@/utils/format';
import {
  compactNumber,
  formatAgo,
  formatCalories,
  formatDistance,
  formatDuration,
  formatDurationCompact,
  formatElevation,
  formatFullDate,
  formatPaceShort,
  formatSpeed,
  formatTimeOfDay,
  formatWeight,
  joinMiddleDot,
} from '@/utils/format';
import { displayRoute } from '@/services/gps';

/** A chart narrower than this cannot fit its axis labels, so it is not drawn at all. */
const MIN_CHART_WIDTH = 120;
/**
 * Route points are per-position, so a long run records thousands of them. Sixty is well
 * past what a 300pt-wide chart can resolve, and sampling down here is what keeps the SVG
 * cheap enough to animate.
 */
const MAX_ELEVATION_SAMPLES = 60;

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);

  const activityId = typeof id === 'string' && id.length > 0 ? id : null;
  const query = useActivity(activityId);
  const activity = query.data ?? null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The draft *is* the open/closed flag: `null` means no sheet, a string (including `''`)
  // means an open one. Two pieces of state would be two ways to disagree about whether a
  // sheet is up.

  const removeActivity = useDeleteActivity();

  const confirmDelete = useCallback(() => {
    if (activityId === null) return;
    removeActivity.mutate(activityId, {
      // Navigating *before* the mutation settles would drop the user onto a list that
      // still shows the row; on success they land on a list that already agrees. On
      // failure the sheet stays up: the row is still there, and so is the chance to
      // retry or back out.
      onSuccess: () => {
        setConfirmingDelete(false);
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
      // No `onError` on purpose, matching the comment above: closing here on failure
      // would make the sheet vanish and the row stay, with nothing to explain it. The
      // reason renders in the sheet itself (see `error` below), and dismissing by hand
      // is the user's own decision rather than ours reacting to an error.
    });
  }, [activityId, removeActivity]);

  const askDelete = useCallback(() => setConfirmingDelete(true), []);
  const transparentInset = useTransparentHeaderInset();
  const topInset = activity !== null ? transparentInset : 0;

  return (
    <>
      {/* A fade rather than a push: this screen is reached from Home, from the list and
          from Progress, and its content is a full-bleed surface: a horizontal slide would
          flash the previous list's rows past the hero number. */}
      <Stack.Screen options={{ animation: 'fade_from_bottom' }} />
      <ScreenHeader
        title={activity?.title ?? t('activity.fallbackTitle')}
        transparent={activity !== null}
      />
      {activity ? (
        <HeaderToolbar placement="right">
          {headerAction({ action: 'delete', onPress: askDelete, t, label: 'activity.delete' })}
        </HeaderToolbar>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset, paddingBottom: insets.bottom + spacing.huge },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {activity ? (
          <MetaLine
            items={[{ icon: 'calendar', label: formatFullDate(activity.startedAt) }]}
            theme={theme}
            style={styles.dateLine}
          />
        ) : null}
        {query.isPending ? (
          <Column gap="lg" style={{ paddingTop: spacing.xl }}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={5} />
          </Column>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            title={t('activity.loadError')}
          />
        ) : activity ? (
          <ActivityBody
            activity={activity}
            units={units}
            showSpeed={showSpeed}
            theme={theme}
            onEditNotes={() => router.push(routes.activityNotes(activity.id))}
          />
        ) : null}
      </ScrollView>

      {confirmingDelete && activity ? (
        <ConfirmDialog
          visible={!removeActivity.isPending}
          title={t('activity.deleteTitle')}
          message={
            removeActivity.isError
              ? removeActivity.error instanceof Error
                ? removeActivity.error.message
                : t('activity.deleteFailed')
              : t('activity.deleteMessage', { name: activity.title })
          }
          confirmLabel={t('activity.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={confirmDelete}
          onCancel={() => {
            // Same reason as the list's delete: leaving the previous failure behind would
            // make a reopened dialog report an attempt that has not happened yet.
            removeActivity.reset();
            setConfirmingDelete(false);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ body -- */

function ActivityBody({
  activity,
  units,
  showSpeed,
  theme,
  onEditNotes,
}: {
  activity: Activity;
  units: UnitSystem;
  showSpeed: boolean;
  theme: Theme;
  onEditNotes: () => void;
}) {
  const { t } = useT();
  const [width, onLayout] = useMeasuredWidth();
  // Charts are measured, not assumed: a `Dimensions` constant would be wrong in split view,
  // on a tablet, and on the day this screen's padding changes.
  const chartWidth = Math.max(0, width - spacing.lg * 2);

  // One call, one object: the headline, the subtitle and the spoken sentence are three
  // views of the same numbers, and computing them separately is how they start disagreeing
  // about rounding.
  const display = activityDisplay(activity, units, showSpeed);

  return (
    <View onLayout={onLayout}>
      {/* One accessibility element for the whole hero, so VoiceOver reads "Tempo run. 8.43 km
          in 52 min" as a sentence rather than four fragments in sequence. The label comes
          from the domain layer because that is what decides what is true about the numbers. */}
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={display.accessibilityLabel}
        style={[styles.hero, { backgroundColor: theme.colors.surface }]}
      >
        <Row gap="sm" align="center">
          <Badge
            label={t(KIND_LABEL[activity.kind])}
            tone={KIND_TONE[activity.kind]}
            icon={
              <Icon
                name={ACTIVITY_ICON[activity.kind]}
                size={13}
                color={theme.colors.tone[activity.kind]}
              />
            }
          />
          <Txt variant="micro" tone="faint">
            {formatTimeOfDay(activity.startedAt)}
          </Txt>
        </Row>
        {/* `display`, not `numeralLg`: this number is read as part of a sentence, and the
            mono face is for values that tick (a timer), not for history. */}
        <Txt variant="display" weight="700" style={{ marginTop: spacing.sm }}>
          {display.headline}
        </Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: spacing.xxs }}>
          {display.subtitle}
        </Txt>
      </View>

      {activity.kind === 'lift' ? (
        <StrengthBody activity={activity} units={units} theme={theme} chartWidth={chartWidth} />
      ) : activity.cardio ? (
        <CardioBody
          activity={activity}
          cardio={activity.cardio}
          units={units}
          showSpeed={showSpeed}
          theme={theme}
          chartWidth={chartWidth}
        />
      ) : (
        <EmptyState
          style={{ paddingTop: spacing.xxxl }}
          title={t('activity.emptyTitle')}
          message={t('activity.emptyMessage')}
          icon="warning"
          compact
        />
      )}

      <NotesBlock activity={activity} onEdit={onEditNotes} />
      <ProvenanceBlock activity={activity} theme={theme} />
    </View>
  );
}

/**
 * Badge copy, as catalog KEYS rather than words.
 *
 * A module-level map of English strings cannot be translated: it is built once, before any
 * component has a language. Holding the key instead means the lookup happens where `t` is,
 * and the map stays a single place to add a kind.
 */
const KIND_LABEL = {
  run: 'activity.kindRun',
  ride: 'activity.kindRide',
  lift: 'activity.kindLift',
  walk: 'activity.kindWalk',
  yoga: 'activity.kindYoga',
} as const satisfies Record<ActivityKind, TKey>;

/** Badge *purposes*, not colours: the theme owns the hue, this owns the meaning. */
const KIND_TONE: Record<ActivityKind, 'accent' | 'info' | 'success' | 'warning'> = {
  run: 'accent',
  ride: 'info',
  lift: 'warning',
  walk: 'success',
  yoga: 'success',
};

/* ---------------------------------------------------------------- cardio -- */

function CardioBody({
  activity,
  cardio,
  units,
  showSpeed,
  theme,
  chartWidth,
}: {
  activity: Activity;
  cardio: CardioMetrics;
  units: UnitSystem;
  showSpeed: boolean;
  theme: Theme;
  chartWidth: number;
}) {
  const { t } = useT();
  // The same thinning the map applies, so "there is a route" is decided by the geometry the
  // map is about to draw rather than by a second, subtly different rule.
  const hasRoute = displayRoute(cardio.route).length >= 2;
  const splits = useMemo(() => splitRows(cardio.splits, units), [cardio.splits, units]);
  const hasDistance = cardio.distanceMeters > 0;
  const hasHr = cardio.avgHeartRate !== null || cardio.maxHeartRate !== null;
  const hasClimb = cardio.elevationGainMeters > 0;

  const speed =
    cardio.avgSpeedMps ??
    (hasDistance ? cardio.distanceMeters / Math.max(1, activity.durationSeconds) : null);

  const paceLabel = !hasDistance
    ? null
    : showSpeed && speed !== null
      ? formatSpeed(speed, units)
      : formatPaceShort(cardio.avgPaceSecPerKm, units);

  const elevation = useMemo<TrendPoint[]>(() => {
    // The raw route, not the map's thinned copy: an altitude curve needs the *time* axis,
    // which resampling for a polyline discards.
    const source = cardio.route;
    const first = source[0];
    if (source.length < 4 || !first) return [];
    const step = Math.max(1, Math.ceil(source.length / MAX_ELEVATION_SAMPLES));
    const points: TrendPoint[] = [];
    for (let i = 0; i < source.length; i += step) {
      const point = source[i];
      if (!point) continue;
      points.push({
        label: formatDurationCompact(Math.round((point.t - first.t) / 1000)),
        value: point.elevation,
      });
    }
    // Two samples make a straight line, which is a claim about every sample between them.
    return points.length >= 3 ? points : [];
  }, [cardio.route]);

  const unitWord = units === 'metric' ? 'kilometre' : 'mile';

  return (
    <>
      <Section>
        {hasRoute ? (
          <RouteMap route={cardio.route} kind={activity.kind} theme={theme} height={280} />
        ) : (
          <Card tone="sunken">
            <Row gap="md" align="start">
              <Icon name="route" size={26} color={theme.colors.textFaint} />
              <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subhead" weight="700">
                  {t('misc.noRouteToDraw')}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {t('misc.noRouteBody')}
                </Txt>
              </Column>
            </Row>
          </Card>
        )}
      </Section>

      <Section gap="lg">
        <SectionHeader title={t('activity.metrics')} eyebrow={t('activity.session')} />
        <MetricGrid columns={2}>
          <Metric
            label={t('activity.duration')}
            value={formatDuration(activity.durationSeconds)}
          />
          <Metric
            label={t('activity.distance')}
            value={hasDistance ? formatDistance(cardio.distanceMeters, units, 2) : null}
            {...(hasDistance ? {} : { note: t('activity.noGps') })}
          />
          <Metric
            label={t(showSpeed ? 'activity.speed' : 'activity.pace')}
            value={paceLabel}
            {...(paceLabel === null ? { note: t('activity.needsDistance') } : {})}
          />
          <Metric
            label={t('activity.calories')}
            value={activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null}
            {...(activity.caloriesKcal > 0 ? {} : { note: t('activity.noEstimate') })}
          />
          <Metric
            label={t('activity.heartRate')}
            value={cardio.avgHeartRate !== null ? `${cardio.avgHeartRate} bpm` : null}
            note={
              hasHr
                ? cardio.maxHeartRate !== null
                  ? t('activity.peakHr', { bpm: cardio.maxHeartRate })
                  : t('activity.avgOnly')
                : t('activity.noSensor')
            }
          />
          <Metric
            label={t('activity.elevation')}
            value={hasClimb ? formatElevation(cardio.elevationGainMeters, units) : null}
            note={t(hasClimb ? 'activity.totalClimb' : 'activity.flat')}
          />
          <Metric
            label={t('activity.cadence')}
            value={cardio.stridesPerMinute !== null ? `${cardio.stridesPerMinute} spm` : null}
            note={t(
              cardio.stridesPerMinute !== null
                ? 'activity.stridesPerMinute'
                : 'activity.notRecorded',
            )}
          />
          <Metric
            label={t('activity.splits')}
            value={splits !== null ? `${splits.length}` : null}
            note={
              splits !== null
                ? t('activity.perUnit', { unit: unitWord })
                : t('activity.tooShortToSplit')
            }
          />
        </MetricGrid>
      </Section>

      {elevation.length > 0 && chartWidth >= MIN_CHART_WIDTH ? (
        <Section>
          <SectionHeader title={t('activity.elevation')} eyebrow={t('activity.acrossSession')} />
          <Card>
            <TrendChart
              points={elevation}
              theme={theme}
              width={chartWidth}
              height={132}
              color={theme.colors.tertiary}
              showGrid={false}
              showDots="never"
              format={(value) => `${Math.round(value)} m`}
            />
            <Txt variant="micro" tone="faint" style={{ paddingTop: spacing.sm }}>
              {t('activity.altitudeNote')}
            </Txt>
          </Card>
        </Section>
      ) : null}

      <Section>
        <SectionHeader
          title={t('activity.splits')}
          eyebrow={t('activity.perUnit', { unit: unitWord })}
          {...(splits !== null ? { count: splits.length } : {})}
        />
        {splits === null ? (
          <Card>
            <Row gap="md" align="start">
              <Icon name="timer" size={22} color={theme.colors.textFaint} />
              <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subhead" weight="700">
                  {t('activity.noSplitsTitle')}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {t(hasDistance ? 'activity.splitsTooShort' : 'activity.splitsNoDistance', {
                    unit: unitWord,
                  })}
                </Txt>
              </Column>
            </Row>
          </Card>
        ) : (
          <SplitTable splits={splits} units={units} theme={theme} />
        )}
      </Section>
    </>
  );
}

function SplitTable({
  splits,
  units,
  theme,
}: {
  splits: SplitRow[];
  units: UnitSystem;
  theme: Theme;
}) {
  const { t } = useT();
  // Columns appear only when at least one split has the data. A column of dashes is worse
  // than no column: it reads as though the *session* failed rather than one sensor.
  const showHeart = splits.some((split) => split.heartRate !== null);
  const showClimb = splits.some((split) => split.elevationGainMeters !== 0);

  return (
    <Card padding="sm">
      <Row gap="md" align="center" style={styles.headRow}>
        <Txt variant="micro" tone="faint" style={styles.narrow}>
          {t(units === 'metric' ? 'activity.colKm' : 'activity.colMi')}
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.cell}>
          {t('activity.colPace')}
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.cell}>
          {t('activity.colTime')}
        </Txt>
        {showHeart ? (
          <Txt variant="micro" tone="faint" align="right" style={styles.cell}>
            {t('activity.colHr')}
          </Txt>
        ) : null}
        {showClimb ? (
          <Txt variant="micro" tone="faint" align="right" style={styles.narrow}>
            {t('activity.colUp')}
          </Txt>
        ) : null}
      </Row>
      {splits.map((split, index) => (
        <View
          // The split's stored index is part of the key: splits can start partway through a
          // session, so the label is not necessarily its position.
          key={`${split.label}-${index}`}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={joinMiddleDot([
            `${t(units === 'metric' ? 'activity.kilometre' : 'activity.mile')} ${split.label}`,
            split.paceLabel,
            formatDurationCompact(split.durationSeconds),
            split.heartRate !== null ? `${split.heartRate} bpm` : null,
            split.fastest ? t('activity.fastest') : null,
            split.slowest && !split.fastest ? t('activity.slowest') : null,
          ])}
        >
          {index > 0 ? <Divider inset={spacing.sm} /> : null}
          <View
            style={[
              styles.dataRow,
              styles.row,
              split.fastest ? { backgroundColor: theme.colors.successSoft } : null,
            ]}
          >
            <Txt variant="caption" weight="700" tone="muted" style={styles.narrow}>
              {split.label}
            </Txt>
            <Txt
              variant="body"
              weight="700"
              color={
                split.fastest
                  ? theme.colors.success
                  : split.slowest
                    ? theme.colors.warning
                    : theme.colors.text
              }
              style={styles.cell}
            >
              {split.paceLabel}
            </Txt>
            <Txt variant="caption" tone="muted" style={styles.cell}>
              {formatDurationCompact(split.durationSeconds)}
            </Txt>
            {showHeart ? (
              <Txt variant="caption" tone="muted" align="right" style={styles.cell}>
                {split.heartRate !== null ? split.heartRate : '-'}
              </Txt>
            ) : null}
            {showClimb ? (
              <Txt variant="micro" tone="faint" align="right" style={styles.narrow}>
                {split.elevationGainMeters !== 0 ? Math.round(split.elevationGainMeters) : '·'}
              </Txt>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

/* -------------------------------------------------------------- strength -- */

function StrengthBody({
  activity,
  units,
  theme,
  chartWidth,
}: {
  activity: Activity;
  units: UnitSystem;
  theme: Theme;
  chartWidth: number;
}) {
  const { t } = useT();
  const strength = activity.strength;
  const entries = strength?.entries ?? [];
  const records = strength?.personalRecords ?? [];
  const planned = entries.reduce((total, entry) => total + entry.sets.length, 0);
  const completed = entries.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const volume = strength?.totalVolumeKg ?? 0;
  const minutes = activity.durationSeconds / 60;

  // Volume per movement, derived here rather than stored: a session whose sets get edited
  // afterwards must not go on showing a chart that contradicts its own set tables.
  const volumePoints = useMemo<TrendPoint[]>(
    () =>
      entries
        .map((entry) => ({
          label: axisLabel(entry.exerciseName),
          value: entry.sets.reduce(
            (sum, set) => (set.completed ? sum + set.reps * set.weightKg : sum),
            0,
          ),
          detail: entry.exerciseName,
        }))
        .filter((point) => point.value > 0),
    [entries],
  );

  return (
    <>
      <Section gap="lg">
        <SectionHeader title={t('activity.session')} eyebrow={t('activity.summary')} />
        <MetricGrid columns={2}>
          <Metric
            label={t('activity.duration')}
            value={formatDuration(activity.durationSeconds)}
          />
          <Metric
            label={t('activity.volume')}
            value={volume > 0 ? `${compactNumber(volume)} kg` : null}
            note={t(volume > 0 ? 'activity.repsTimesWeight' : 'activity.bodyweightWork')}
          />
          <Metric
            label={t('activity.sets')}
            value={planned > 0 ? `${completed}/${planned}` : null}
            note={t(planned > 0 ? 'activity.completed' : 'activity.noSets')}
          />
          <Metric
            label={t('activity.movements')}
            value={entries.length > 0 ? `${entries.length}` : null}
            note={
              entries.length > 0
                ? `${entries.length} ${t('activity.exerciseWord', { count: entries.length })}`
                : t('activity.nothingAdded')
            }
          />
          <Metric
            label={t('activity.calories')}
            value={activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null}
            {...(activity.caloriesKcal > 0 ? {} : { note: t('activity.noEstimate') })}
          />
          <Metric
            label={t('activity.density')}
            value={volume > 0 && minutes >= 1 ? `${Math.round(volume / minutes)} kg/min` : null}
            note={t(
              volume > 0 && minutes >= 1 ? 'activity.volumePerMinute' : 'activity.needsMinute',
            )}
          />
        </MetricGrid>
      </Section>

      {volumePoints.length >= 2 && chartWidth >= MIN_CHART_WIDTH ? (
        <Section>
          <SectionHeader
            title={t('activity.volume')}
            eyebrow={t('activity.perMovement')}
            counter={volumePoints.length}
          />
          <Card>
            <TrendChart
              points={volumePoints}
              theme={theme}
              width={chartWidth}
              height={150}
              includeZero
              showDots="always"
              format={(value) => `${compactNumber(value)} kg`}
            />
          </Card>
        </Section>
      ) : null}

      <Section>
        <SectionHeader
          title={t('activity.exercises')}
          eyebrow={t('activity.work')}
          counter={entries.length}
        />
        {entries.map((entry, index) => (
          <ExerciseCard key={`${entry.exerciseId}-${index}`} entry={entry} units={units} />
        ))}
      </Section>

      {records.length > 0 ? (
        <Section>
          <SectionHeader
            title={t('activity.records')}
            eyebrow={t('activity.setThisSession')}
            counter={records.length}
          />
          <Card tone="accent">
            <Column gap="lg">
              {records.map((record) => (
                <Row key={`${record.exerciseId}-${record.kind}`} gap="md" align="center">
                  <Icon name="trophy" size={20} color={theme.colors.onAccent} />
                  <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                    <Txt variant="subhead" weight="700" numberOfLines={1}>
                      {record.exerciseName}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {t(RECORD_LABEL[record.kind])}
                      {record.previousValue === null
                        ? t('activity.firstOfKind')
                        : t('activity.upFrom', {
                            value: formatRecordValue(record.kind, record.previousValue, units),
                          })}
                    </Txt>
                  </Column>
                  <Txt variant="headline" weight="700">
                    {formatRecordValue(record.kind, record.value, units)}
                  </Txt>
                </Row>
              ))}
            </Column>
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function ExerciseCard({ entry, units }: { entry: StrengthEntry; units: UnitSystem }) {
  const { t } = useT();
  const top = useMemo(() => heaviestCompletedSet(entry.sets), [entry.sets]);
  const done = entry.sets.filter((set) => set.completed).length;
  const planned = entry.sets.length;

  return (
    <Card padding="md">
      <Column gap="md">
        <Row gap="md" align="center">
          <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="subhead" weight="700" numberOfLines={2}>
              {entry.exerciseName}
            </Txt>
            <Txt variant="caption" tone="muted">
              {joinMiddleDot([
                `${done}/${planned} ${t('activity.setWord', { count: planned })}`,
                entry.muscleGroup,
                top
                  ? t('activity.topSet', {
                      weight:
                        top.weightKg === 0
                          ? t('activity.bodyweightShort')
                          : formatWeight(top.weightKg, units),
                      reps: top.reps,
                    })
                  : null,
              ])}
            </Txt>
          </Column>
          <Badge
            label={
              done === 0
                ? t('activity.skipped')
                : done === planned
                  ? t('activity.allDone')
                  : `${done}/${planned}`
            }
            tone={done === 0 ? 'warning' : done === planned ? 'success' : 'neutral'}
          />
        </Row>

        {planned > 0 ? (
          <>
            <Divider />
            <Row gap="md" align="center" style={styles.headRow}>
              <Txt variant="micro" tone="faint" style={styles.narrow}>
                {t('activity.colSet')}
              </Txt>
              <Txt variant="micro" tone="faint" style={styles.cell}>
                {t(units === 'metric' ? 'activity.colKg' : 'activity.colLb')}
              </Txt>
              <Txt variant="micro" tone="faint" style={styles.cell}>
                {t('activity.colReps')}
              </Txt>
              <Txt variant="micro" tone="faint" align="right" style={styles.wide}>
                {t('activity.colE1rm')}
              </Txt>
            </Row>
            {entry.sets.map((set, index) => (
              <View key={`${set.index}-${index}`}>
                {index > 0 ? <Divider inset={spacing.sm} /> : null}
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel={
                    set.completed
                      ? joinMiddleDot([
                          t('activity.setNumber', { n: index + 1 }),
                          set.weightKg === 0
                            ? t('activity.bodyweight')
                            : formatWeight(set.weightKg, units),
                          `${set.reps} ${t('activity.repWord', { count: set.reps })}`,
                        ])
                      : t('activity.setNotDone', { n: index + 1 })
                  }
                  style={[styles.dataRow, styles.row, set.completed ? null : styles.dimmed]}
                >
                  <Txt variant="caption" weight="700" tone="muted" style={styles.narrow}>
                    {index + 1}
                  </Txt>
                  <Txt variant="body" weight="700" style={styles.cell}>
                    {set.weightKg === 0
                      ? t('activity.bodyweightShort')
                      : formatWeight(set.weightKg, units)}
                  </Txt>
                  <Txt variant="body" style={styles.cell}>
                    {set.reps}
                  </Txt>
                  <Txt variant="caption" tone="muted" align="right" style={styles.wide}>
                    {oneRepMaxLabel(set, units)}
                  </Txt>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {entry.notes ? (
          <>
            <Divider />
            <Txt variant="caption" tone="muted">
              {entry.notes}
            </Txt>
          </>
        ) : null}
      </Column>
    </Card>
  );
}

/* ----------------------------------------------------------------- notes -- */

function NotesBlock({ activity, onEdit }: { activity: Activity; onEdit: () => void }) {
  const { t } = useT();
  const hasNotes = activity.notes !== null;
  return (
    <Section>
      <SectionHeader title={t('activity.notesSection')} eyebrow={t('activity.session')} />
      <Card>
        {/* Selectable so a note can be copied into a training log elsewhere without the app
            needing a share sheet it does not have. */}
        <Txt selectable variant="body" numberOfLines={8}>
          {hasNotes
            ? activity.notes
            : t('activity.notesEmpty')}
        </Txt>
      </Card>
      {/* `ActionRow` paints its own surface, padding and chevron, so it is a row on this
          screen rather than something wrapped in a second card: nesting the two gives a
          card inside a card with two radii that do not line up. */}
      <ActionRow
        title={t(hasNotes ? 'activity.editNotes' : 'activity.addNotes')}
        {...(hasNotes ? { subtitle: t('activity.notesSubtitle') } : {})}
        icon="edit"
        onPress={onEdit}
      />
    </Section>
  );
}

/**
 * Where the session came from.
 *
 * Seeded rows say so in the first four words. The app ships with a history so the charts
 * have a shape on first launch, and a user who later found their "first run" was fabricated
 * would reasonably distrust every other number in here: so the honest label costs one line
 * of copy and buys the credibility of the other thirty.
 */
function ProvenanceBlock({ activity, theme }: { activity: Activity; theme: Theme }) {
  const { t } = useT();
  const icon: IconName = activity.seeded
    ? 'info'
    : activity.sourceSessionId
      ? 'checkCircle'
      : 'edit';
  return (
    <Section>
      <Card tone="sunken">
        <Row gap="md" align="start">
          <Icon name={icon} size={20} color={theme.colors.textMuted} />
          <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="label" weight="700">
              {t(
                activity.seeded
                  ? 'activity.sampleTitle'
                  : activity.sourceSessionId
                    ? 'activity.trackedTitle'
                    : 'activity.manualTitle',
              )}
            </Txt>
            <Txt variant="micro" tone="muted">
              {activity.seeded
                ? t('activity.sampleNote')
                : activity.sourceSessionId
                  ? t('activity.recordedAgo', { ago: formatAgo(activity.startedAt) })
                  : t('activity.manualNote')}
            </Txt>
          </Column>
        </Row>
      </Card>
    </Section>
  );
}

/* ---------------------------------------------------------------- pieces -- */

/**
 * One metric cell. The "`null` means unmeasured" contract is the point of the component, * see the file header.
 */
function Metric({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const { t } = useT();
  const missing = value === null;
  return (
    <Column gap="xxs">
      <MetricLabel label={label} />
      <Txt variant="numeralSm" weight="700" tone={missing ? 'faint' : 'default'} numberOfLines={1}>
        {missing ? '-' : value}
      </Txt>
      {note || missing ? (
        <Txt variant="micro" tone="faint" numberOfLines={2}>
          {note ?? t('activity.notMeasured')}
        </Txt>
      ) : null}
    </Column>
  );
}

/**
 * A section: fixed rhythm above the title, chosen gap within the group.
 *
 * Small enough to be a `View` with two styles, but every section on this screen is `pt-xxl`
 * above and `gap-md` inside, and a screen that spells that out twenty times is a screen
 * where section twenty-one quietly gets `pt-xl` and the vertical rhythm is gone.
 */
function Section({ gap = 'md', children }: { gap?: 'md' | 'lg'; children: ReactNode }) {
  return (
    <Column gap={gap} style={styles.section}>
      {children}
    </Column>
  );
}

/* --------------------------------------------------------------- helpers -- */

/**
 * The heaviest completed set by estimated 1RM, or `null` when nothing was completed.
 * `estimated1rm` is computed on write, so the stored value wins; the recompute covers rows
 * seeded before the field existed.
 */
function heaviestCompletedSet(sets: readonly StrengthSet[]): StrengthSet | null {
  let best: StrengthSet | null = null;
  let bestMax = -1;
  for (const set of sets) {
    if (!set.completed) continue;
    const max = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps) ?? set.weightKg;
    if (max > bestMax) {
      best = set;
      bestMax = max;
    }
  }
  return best;
}

/**
 * A set's estimated ceiling, or a dash.
 * `estimatedOneRepMax` answers `null` for bodyweight work and for rep ranges past 15, where
 * Epley is extrapolating rather than estimating: and printing an invented ceiling above a
 * set of 25 bodyweight reps is exactly the invented number this screen exists to avoid.
 */
function oneRepMaxLabel(set: StrengthSet, units: UnitSystem): string {
  if (!set.completed) return '-';
  const max = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps);
  return max === null ? '-' : formatWeight(max, units);
}

/** Chart axis labels are a handful of characters; the full name belongs in `detail`. */
function axisLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length <= 8 ? first : `${first.slice(0, 7)}…`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter },
  dateLine: { paddingTop: spacing.md },
  hero: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.xl },
  section: { paddingTop: spacing.xxxl },
  headRow: { paddingVertical: spacing.xs },
  dataRow: {
    paddingVertical: spacing.md,
    // The highlight has to bleed past the card's inner padding to read as a band rather
    // than a swatch, so the row borrows the space back as its own padding.
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  /** A planned-but-not-done set is part of the record, so it is dimmed rather than hidden. */
  dimmed: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  narrow: { width: 30 },
  wide: { width: 54 },
  cell: { flex: 1 },
  noteBody: { paddingHorizontal: screenGutter, paddingBottom: spacing.lg },
});
