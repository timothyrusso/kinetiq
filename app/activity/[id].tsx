/**
 * Activity detail — one session, read back.
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
 * rate. Every such gap renders a dash plus one line saying why that is normal — rather than
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
 * will itself use — the "is there a route" test then cannot disagree with the drawing.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailScreen } from '@/ui/Screen';
import {
  Badge,
  Card,
  Divider,
  MetricGrid,
  Row,
  SectionHeader,
  Stack as Column,
} from '@/ui/layout';
import { MetricLabel, Txt } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/icons';
import { ActionRow, Button, IconButton } from '@/ui/Button';
import { ACTIVITY_ICON } from '@/ui/rows';
import { ConfirmSheet, Sheet, SheetFooter } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { RouteMap } from '@/ui/RouteMap';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { useMeasuredWidth } from '@/ui/charts/Sparkline';
import {
  useActivity,
  useDeleteActivity,
  useUpdateActivityNotes,
} from '@/queries/useActivities';
  // Record wording lives next to the record query, so this screen and the exercise detail,
  // cannot drift into calling the same record two different things.,
import { RECORD_LABEL, formatRecordValue } from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings/hooks';
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
import { radius, spacing } from '@/theme/tokens';
import type { UnitSystem } from '@/utils/format';
import {
  compactNumber,
  countNoun,
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
  pluralWord,
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
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const removeActivity = useDeleteActivity();
  const saveNotes = useUpdateActivityNotes();

  const commitNotes = useCallback(() => {
    if (activityId === null || notesDraft === null) return;
    const trimmed = notesDraft.trim();
    saveNotes.mutate(
      // An emptied field clears the note rather than storing `""`: `notes` is `string |
      // null` in the schema, and an empty string would make every edited row look annotated.
      { id: activityId, notes: trimmed.length === 0 ? null : trimmed },
      // `onSuccess`, not `onSettled`. Closing on settle closes on *failure* too, and
      // the draft lives only in this screen's state — the user's typed paragraph would
      // vanish while the note it describes stayed unwritten. On failure the sheet stays
      // up, the field keeps its text, and the reason appears under it.
      { onSuccess: () => setNotesDraft(null) },
    );
  }, [activityId, notesDraft, saveNotes]);

  const confirmDelete = useCallback(() => {
    if (activityId === null) return;
    removeActivity.mutate(activityId, {
      // Navigating *before* the mutation settles would drop the user onto a list that
      // still shows the row; on success they land on a list that already agrees. On
      // failure the sheet stays up — the row is still there, and so is the chance to
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

  return (
    <>
      {/* A fade rather than a push: this screen is reached from Home, from the list and
          from Progress, and its content is a full-bleed surface — a horizontal slide would
          flash the previous list's rows past the hero number. */}
      <Stack.Screen options={{ animation: 'fade_from_bottom' }} />
      <DetailScreen
        title={activity?.title ?? 'Activity'}
        {...(activity ? { subtitle: formatFullDate(activity.startedAt) } : {})}
        headerTransparent={activity !== null}
        right={
          activity ? (
            <IconButton
              name="trash"
              variant="danger"
              size={20}
              weighty
              accessibilityLabel="Delete this activity"
              accessibilityHint="Opens a confirmation"
              onPress={() => setConfirmingDelete(true)}
            />
          ) : undefined
        }
      >
        {(topInset, header) => (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingTop: topInset, paddingBottom: insets.bottom + spacing.huge },
            ]}
            onScroll={header.onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {query.isPending ? (
              <Column gap="lg" style={{ paddingTop: spacing.xl }}>
                <SkeletonCard lines={3} />
                <SkeletonCard lines={5} />
              </Column>
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
                title="Could not open this activity"
              />
            ) : activity ? (
              <ActivityBody
                activity={activity}
                units={units}
                showSpeed={showSpeed}
                theme={theme}
                onEditNotes={() => setNotesDraft(activity.notes ?? '')}
              />
            ) : null}
          </ScrollView>
        )}
      </DetailScreen>

      {notesDraft !== null ? (
        <Sheet
          onRequestClose={() => setNotesDraft(null)}
          title="Session notes"
          {...(activity ? { subtitle: activity.title } : {})}
        >
          {/* Not wrapped in `SheetSection`: the header already says "Session notes", and
              `TextField` prints its own label above the box. Both at once reads as "NOTES /
              NOTES" — the section title and the field label are the same word twice, in two
              colours, two lines apart. `SheetFooter` still supplies the divider below. */}
          <TextField
            label="Notes"
            value={notesDraft}
            onChangeText={(text) => {
              // Typing again means the user is trying a second time, so the previous
              // failure stops being true information about the field.
              if (saveNotes.isError) saveNotes.reset();
              setNotesDraft(text);
            }}
            multiline
            autoFocus
            placeholder="How did it feel? What would you change next time?"
            hint="Stored on this device alongside the activity."
            // The write is a disk write, and disks fail — full storage, a row deleted
            // from another screen, a migration that did not run. Without this the
            // sheet would simply refuse to close, which reads as an app that ignores
            // the Save button. Naming the reason turns a mystery into a retry.
            {...(saveNotes.isError
              ? {
                  error:
                    saveNotes.error instanceof Error
                      ? saveNotes.error.message
                      : 'The note could not be saved.',
                }
              : {})}
          />
          <SheetFooter>
            <Button label="Cancel" variant="quiet" onPress={() => setNotesDraft(null)} />
            <Button
              label="Save"
              variant="primary"
              fullWidth
              loading={saveNotes.isPending}
              onPress={commitNotes}
            />
          </SheetFooter>
        </Sheet>
      ) : null}

      {confirmingDelete && activity ? (
        <ConfirmSheet
          title="Delete this session?"
          message={`"${activity.title}" goes with it, route included. Its numbers come out of your totals and records once it is gone, so the charts will move.`}
          confirmLabel={removeActivity.isPending ? 'Deleting' : 'Delete session'}
          onConfirm={confirmDelete}
          onRequestClose={() => {
            // Same reason as the list's delete sheet: leaving the previous failure behind
            // would make a reopened sheet report an attempt that has not happened yet.
            removeActivity.reset();
            setConfirmingDelete(false);
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
            label={KIND_LABEL[activity.kind]}
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
          title="Nothing was captured"
          message="This session has a duration and no metrics. It still counts toward your streak and your totals."
          icon="warning"
          compact
        />
      )}

      <NotesBlock activity={activity} onEdit={onEditNotes} />
      <ProvenanceBlock activity={activity} theme={theme} />
    </View>
  );
}

const KIND_LABEL: Record<ActivityKind, string> = {
  run: 'Run',
  ride: 'Ride',
  lift: 'Strength',
  walk: 'Walk',
  yoga: 'Yoga',
};

/** Badge *purposes*, not colours — the theme owns the hue, this owns the meaning. */
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
                  No route to draw
                </Txt>
                <Txt variant="caption" tone="muted">
                  Nothing was traced. An indoor session and a GPS fix that never arrived both
                  look like this — duration, pace and splits below are still exact.
                </Txt>
              </Column>
            </Row>
          </Card>
        )}
      </Section>

      <Section gap="lg">
        <SectionHeader title="Metrics" eyebrow="Session" />
        <MetricGrid columns={2}>
          <Metric label="Duration" value={formatDuration(activity.durationSeconds)} />
          <Metric
            label="Distance"
            value={hasDistance ? formatDistance(cardio.distanceMeters, units, 2) : null}
            {...(hasDistance ? {} : { note: 'Indoor, or no GPS fix' })}
          />
          <Metric
            label={showSpeed ? 'Speed' : 'Pace'}
            value={paceLabel}
            {...(paceLabel === null ? { note: 'Needs distance' } : {})}
          />
          <Metric
            label="Calories"
            value={activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null}
            {...(activity.caloriesKcal > 0 ? {} : { note: 'Estimate unavailable' })}
          />
          <Metric
            label="Heart rate"
            value={cardio.avgHeartRate !== null ? `${cardio.avgHeartRate} bpm` : null}
            note={
              hasHr
                ? cardio.maxHeartRate !== null
                  ? `Peak ${cardio.maxHeartRate} bpm`
                  : 'Average only'
                : 'No sensor this session'
            }
          />
          <Metric
            label="Elevation"
            value={hasClimb ? formatElevation(cardio.elevationGainMeters, units) : null}
            note={hasClimb ? 'Total climb' : 'Flat, or no barometer'}
          />
          <Metric
            label="Cadence"
            value={cardio.stridesPerMinute !== null ? `${cardio.stridesPerMinute} spm` : null}
            note={cardio.stridesPerMinute !== null ? 'Strides per minute' : 'Not recorded'}
          />
          <Metric
            label="Splits"
            value={splits !== null ? `${splits.length}` : null}
            note={splits !== null ? `Per ${unitWord}` : 'Too short to split'}
          />
        </MetricGrid>
      </Section>

      {elevation.length > 0 && chartWidth >= MIN_CHART_WIDTH ? (
        <Section>
          <SectionHeader title="Elevation" eyebrow="Across the session" />
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
              Altitude as the device reported it, sampled along the trace.
            </Txt>
          </Card>
        </Section>
      ) : null}

      <Section>
        <SectionHeader
          title="Splits"
          eyebrow={`Per ${unitWord}`}
          {...(splits !== null ? { count: splits.length } : {})}
        />
        {splits === null ? (
          <Card>
            <Row gap="md" align="start">
              <Icon name="timer" size={22} color={theme.colors.textFaint} />
              <Column gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subhead" weight="700">
                  No splits to show
                </Txt>
                <Txt variant="caption" tone="muted">
                  {hasDistance
                    ? `This session was shorter than a ${unitWord}, so there is nothing to break down.`
                    : `Distance was never measured, so there is no ${unitWord} to break down. Duration above is still exact.`}
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
  // Columns appear only when at least one split has the data. A column of dashes is worse
  // than no column: it reads as though the *session* failed rather than one sensor.
  const showHeart = splits.some((split) => split.heartRate !== null);
  const showClimb = splits.some((split) => split.elevationGainMeters !== 0);

  return (
    <Card padding="sm">
      <Row gap="md" align="center" style={styles.headRow}>
        <Txt variant="micro" tone="faint" style={styles.narrow}>
          {units === 'metric' ? 'KM' : 'MI'}
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.cell}>
          PACE
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.cell}>
          TIME
        </Txt>
        {showHeart ? (
          <Txt variant="micro" tone="faint" align="right" style={styles.cell}>
            HR
          </Txt>
        ) : null}
        {showClimb ? (
          <Txt variant="micro" tone="faint" align="right" style={styles.narrow}>
            UP
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
            `${units === 'metric' ? 'Kilometre' : 'Mile'} ${split.label}`,
            split.paceLabel,
            formatDurationCompact(split.durationSeconds),
            split.heartRate !== null ? `${split.heartRate} bpm` : null,
            split.fastest ? 'fastest' : null,
            split.slowest && !split.fastest ? 'slowest' : null,
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
                {split.heartRate !== null ? split.heartRate : '—'}
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
        <SectionHeader title="Session" eyebrow="Summary" />
        <MetricGrid columns={2}>
          <Metric label="Duration" value={formatDuration(activity.durationSeconds)} />
          <Metric
            label="Volume"
            value={volume > 0 ? `${compactNumber(volume)} kg` : null}
            note={volume > 0 ? 'Reps × weight' : 'Bodyweight work, or nothing completed'}
          />
          <Metric
            label="Sets"
            value={planned > 0 ? `${completed}/${planned}` : null}
            note={planned > 0 ? 'completed' : 'No sets recorded'}
          />
          <Metric
            label="Movements"
            value={entries.length > 0 ? `${entries.length}` : null}
            note={entries.length > 0 ? countNoun(entries.length, 'exercise') : 'Nothing added'}
          />
          <Metric
            label="Calories"
            value={activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null}
            {...(activity.caloriesKcal > 0 ? {} : { note: 'Estimate unavailable' })}
          />
          <Metric
            label="Density"
            value={volume > 0 && minutes >= 1 ? `${Math.round(volume / minutes)} kg/min` : null}
            note={volume > 0 && minutes >= 1 ? 'Volume per minute' : 'Needs a minute of volume'}
          />
        </MetricGrid>
      </Section>

      {volumePoints.length >= 2 && chartWidth >= MIN_CHART_WIDTH ? (
        <Section>
          <SectionHeader title="Volume" eyebrow="Per movement" count={volumePoints.length} />
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
        <SectionHeader title="Exercises" eyebrow="Work" count={entries.length} />
        {entries.map((entry, index) => (
          <ExerciseCard key={`${entry.exerciseId}-${index}`} entry={entry} units={units} />
        ))}
      </Section>

      {records.length > 0 ? (
        <Section>
          <SectionHeader title="Records" eyebrow="Set this session" count={records.length} />
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
                      {RECORD_LABEL[record.kind]}
                      {record.previousValue === null
                        ? ' — first of its kind'
                        : ` — up from ${formatRecordValue(record.kind, record.previousValue, units)}`}
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
                `${done}/${planned} ${pluralWord(planned, 'set')}`,
                entry.muscleGroup,
                top
                  ? `Top ${top.weightKg === 0 ? 'BW' : formatWeight(top.weightKg, units)} × ${top.reps}`
                  : null,
              ])}
            </Txt>
          </Column>
          <Badge
            label={done === 0 ? 'Skipped' : done === planned ? 'All done' : `${done}/${planned}`}
            tone={done === 0 ? 'warning' : done === planned ? 'success' : 'neutral'}
          />
        </Row>

        {planned > 0 ? (
          <>
            <Divider />
            <Row gap="md" align="center" style={styles.headRow}>
              <Txt variant="micro" tone="faint" style={styles.narrow}>
                SET
              </Txt>
              <Txt variant="micro" tone="faint" style={styles.cell}>
                {units === 'metric' ? 'KG' : 'LB'}
              </Txt>
              <Txt variant="micro" tone="faint" style={styles.cell}>
                REPS
              </Txt>
              <Txt variant="micro" tone="faint" align="right" style={styles.wide}>
                E-1RM
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
                          `Set ${index + 1}`,
                          set.weightKg === 0 ? 'bodyweight' : formatWeight(set.weightKg, units),
                          `${set.reps} ${pluralWord(set.reps, 'rep')}`,
                        ])
                      : `Set ${index + 1} not completed`
                  }
                  style={[styles.dataRow, styles.row, set.completed ? null : styles.dimmed]}
                >
                  <Txt variant="caption" weight="700" tone="muted" style={styles.narrow}>
                    {index + 1}
                  </Txt>
                  <Txt variant="body" weight="700" style={styles.cell}>
                    {set.weightKg === 0 ? 'BW' : formatWeight(set.weightKg, units)}
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
  const hasNotes = activity.notes !== null;
  return (
    <Section>
      <SectionHeader title="Notes" eyebrow="Session" />
      <Card>
        {/* Selectable so a note can be copied into a training log elsewhere without the app
            needing a share sheet it does not have. */}
        <Txt selectable variant="body" numberOfLines={8}>
          {hasNotes
            ? activity.notes
            : 'Nothing written for this session yet. A line about how it felt is the part you will wish you had in three months.'}
        </Txt>
      </Card>
      {/* `ActionRow` paints its own surface, padding and chevron, so it is a row on this
          screen rather than something wrapped in a second card — nesting the two gives a
          card inside a card with two radii that do not line up. */}
      <ActionRow
        title={hasNotes ? 'Edit notes' : 'Add notes'}
        {...(hasNotes ? { subtitle: 'How it felt, what to change next time' } : {})}
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
 * would reasonably distrust every other number in here — so the honest label costs one line
 * of copy and buys the credibility of the other thirty.
 */
function ProvenanceBlock({ activity, theme }: { activity: Activity; theme: Theme }) {
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
              {activity.seeded
                ? 'Sample activity'
                : activity.sourceSessionId
                  ? 'Tracked in Kinetiq'
                  : 'Added manually'}
            </Txt>
            <Txt variant="micro" tone="muted">
              {activity.seeded
                ? 'Ships with the app so the charts have a shape. Delete it any time.'
                : activity.sourceSessionId
                  ? `Recorded ${formatAgo(activity.startedAt)}`
                  : 'Created from a routine without the tracker running'}
            </Txt>
          </Column>
        </Row>
      </Card>
    </Section>
  );
}

/* ---------------------------------------------------------------- pieces -- */

/**
 * One metric cell. The "`null` means unmeasured" contract is the point of the component —
 * see the file header.
 */
function Metric({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const missing = value === null;
  return (
    <Column gap="xxs">
      <MetricLabel label={label} />
      <Txt variant="numeralSm" weight="700" tone={missing ? 'faint' : 'default'} numberOfLines={1}>
        {missing ? '—' : value}
      </Txt>
      {note || missing ? (
        <Txt variant="micro" tone="faint" numberOfLines={2}>
          {note ?? 'Not measured'}
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
 * Epley is extrapolating rather than estimating — and printing an invented ceiling above a
 * set of 25 bodyweight reps is exactly the invented number this screen exists to avoid.
 */
function oneRepMaxLabel(set: StrengthSet, units: UnitSystem): string {
  if (!set.completed) return '—';
  const max = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps);
  return max === null ? '—' : formatWeight(max, units);
}

/** Chart axis labels are a handful of characters; the full name belongs in `detail`. */
function axisLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length <= 8 ? first : `${first.slice(0, 7)}…`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg },
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
  noteBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
