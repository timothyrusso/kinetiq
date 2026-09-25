/**
 * Workout tab: the front door to training.
 *
 * ## Ordered by what the user is mid-way through
 *
 * Two states, one priority: an in-flight session goes first (it is unfinished and
 * time-sensitive), then routines. A screen that keeps leading with
 * "start something new" while a set sits half-completed is asking to be abandoned, so the
 * resume card is not a banner appended to a list: it *is* the first thing on screen.
 *
 * ## A scroll view, not a list
 *
 * Home uses FlashList because its content is unbounded. Here it is bounded: routines are local
 * and a keen lifter has a dozen. Virtualising that means a recycle pool larger than the content.
 * The scroll view also lets the routine rows sit as plain siblings, which is what the
 * hairline-divider rhythm between them wants.
 *
 * ## The session is watched by the card, not by the screen
 *
 * The live session republishes once a second while a workout runs. Read here, that tick
 * re-rendered the whole tab every second: the native segmented control, every routine row, the
 * chart, and the header options (a fresh options object is a `setOptions` on the navigator),
 * which is what the dropped frames on this tab were. The screen asks only the boolean "is one
 * running", and the resume card is the one subscriber to the tick.
 *
 * ## No history list
 *
 * Activities owns history. Repeating it here would be a second list with a second sort and
 * no second purpose. What this tab can answer that Activities cannot is "which routines am
 * I actually running, and when did I last do each?": so that lives on the routine rows.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTabContentBottom } from '@/ui/insets';

import { Button } from '@/ui/controls/Button';
import { Card, Row } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { MetaLine, type MetaItem } from '@/ui/display';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { RoutineRow } from '@/ui/rows';
import { SegmentedControl } from '@/ui/controls/SegmentedControl';
import { MetricLabel, Txt } from '@/ui/Text';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { ProgressRing } from '@/ui/charts/ProgressRing';
import { useMeasuredWidth } from '@/ui/charts/useMeasuredWidth';
import { BarChart, type BarPoint } from '@/ui/charts/BarChart';
import { useRoutines } from '@/queries/useRoutines';
import { routes } from '@/navigation/nav';
import type { Routine } from '@/domain/types';
import { useAppTheme, type Theme } from '@/theme/theme';
import { useT } from '@/i18n/useT';
import type { TKey, TVars } from '@/i18n';
import { spacing, screenGutter } from '@/theme/tokens';
import { formatTimer } from '@/utils/format';
import { useSettings } from '@/settings';
import { haptics } from '@/services/haptics';
import { useStartRoutine } from '@/workout/startRoutine';
import { useWorkoutRunning, useWorkoutSession } from '@/workout/session';
import { formatAgoLocalized } from '@/utils/relativeTime';

type Order = 'recent' | 'name';

/** Keys, not words: module scope has no language. Resolved where the control renders. */
const ORDER_SEGMENTS: readonly { value: Order; label: TKey }[] = [
  { value: 'recent', label: 'workoutTab.orderRecent' },
  { value: 'name', label: 'workoutTab.orderName' },
];

/** Clearance for the floating tab bar, which this tab is inside. */
const CARD_PADDING = spacing.lg;

export default function WorkoutScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();

  const routines = useRoutines();
  const [order, setOrder] = useState<Order>('recent');
  const [sectionWidth, measureSection] = useMeasuredWidth();

  // One card covers both "I am mid-set" and "the app was killed mid-set", because by the time
  // this screen can see either they are the same object: bootstrap restores an unfinished
  // session and immediately pauses it, so a crashed workout arrives as a paused one. There is
  // no separate "recover" state to surface here, and inventing one would mean a second card
  // with a second button pointing at the same session. A boolean, so the tick stays in the card.
  const resuming = useWorkoutRunning();

  const sorted = useMemo(() => {
    const items = [...routines.routines];
    if (order === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return items;
    }
    // Never-trained routines sort by creation, trained ones by last performed, and the
    // untrained group goes last: "recent" means what I've actually been doing, and a
    // routine created yesterday and never run is not part of that.
    items.sort((a, b) => {
      if (a.lastPerformedAt === null && b.lastPerformedAt !== null) return 1;
      if (b.lastPerformedAt === null && a.lastPerformedAt !== null) return -1;
      if (a.lastPerformedAt !== null && b.lastPerformedAt !== null) {
        return b.lastPerformedAt - a.lastPerformedAt;
      }
      return b.createdAt - a.createdAt;
    });
    return items;
  }, [order, routines.routines]);

  const openRoutine = useCallback((id: string) => router.push(routes.routine(id)), [router]);
  const openNewRoutine = useCallback(() => router.push(routes.newRoutine()), [router]);
  const openSession = useCallback(() => router.push(routes.workoutSession()), [router]);
  const orderSegments = useMemo(
    () => ORDER_SEGMENTS.map((seg) => ({ value: seg.value, label: t(seg.label) })),
    [t],
  );
  const intro = useMemo<MetaItem[]>(
    () => [
      {
        icon: 'layers',
        label:
          routines.count === 0
            ? t('workoutTab.buildOnce')
            : t('workoutTab.routinesReady', {
                count: routines.count,
                word: t('workoutTab.routineWord', { count: routines.count }),
              }),
      },
    ],
    [routines.count, t],
  );

  const mostRecent = useMemo(() => {
    const trained = routines.routines.filter((r) => r.lastPerformedAt !== null);
    if (trained.length === 0) return null;
    return trained.reduce((a, b) =>
      (b.lastPerformedAt ?? 0) > (a.lastPerformedAt ?? 0) ? b : a,
    );
  }, [routines.routines]);

  const gridWidth = sectionWidth;

  return (
    <>
      <ScreenHeader title={t('workout.title')} largeTitle />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'add', onPress: openNewRoutine, t, label: 'workout.newRoutine' })}
      </HeaderToolbar>

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <MetaLine items={intro} theme={theme} wrap style={styles.intro} />

        {resuming ? <LiveResumeCard onPress={openSession} /> : null}

        {mostRecent && !resuming ? (
          <LastTrainedCard routine={mostRecent} onOpen={openRoutine} />
        ) : null}

        <View style={styles.section} onLayout={measureSection}>
          <SectionHeader
            title={t('workout.yourRoutines')}
            eyebrow={t('workoutTab.saved')}
            {...(routines.count > 0 ? { counter: routines.count } : {})}
            action={{ label: t('workoutTab.new'), onPress: openNewRoutine }}
          />
          {routines.routines.length > 1 ? (
            <View style={styles.order}>
              <SegmentedControl segments={orderSegments} value={order} onChange={setOrder} />
            </View>
          ) : null}

          {routines.isLoading ? (
            <SkeletonCard lines={2} />
          ) : routines.error ? (
            <ErrorState
              error={routines.error}
              onRetry={() => void routines.refresh()}
              title={t('workoutTab.routinesError')}
            />
          ) : routines.isEmpty ? (
            <EmptyState
              title={t('workoutTab.emptyTitle')}
              message={t('workoutTab.emptyMessage')}
              icon="dumbbell"
              actionLabel={t('workoutTab.createRoutine')}
              onAction={openNewRoutine}
              compact
            />
          ) : (
            <View>
              {sorted.map((routine, index) => (
                <RoutineItem
                  key={routine.id}
                  routine={routine}
                  theme={theme}
                  t={t}
                  locale={locale}
                  first={index === 0}
                  onOpen={openRoutine}
                />
              ))}
            </View>
          )}
        </View>

        <SessionCounts routines={routines.routines} width={gridWidth} />
      </ScrollView>
    </>
  );
}

/**
 * The resume card, fed by the live session.
 *
 * The only component on this tab that reads the session itself, so the once-a-second tick
 * re-renders this card and nothing above it.
 */
function LiveResumeCard({ onPress }: { onPress: () => void }) {
  const { session } = useWorkoutSession();
  if (session === null || (session.status !== 'active' && session.status !== 'paused')) return null;
  let completed = 0;
  let total = 0;
  for (const entry of session.entries) {
    total += entry.sets.length;
    for (const set of entry.sets) if (set.completed) completed += 1;
  }
  return (
    <ResumeCard
      routineName={session.routineName}
      paused={session.status === 'paused'}
      elapsedSeconds={session.elapsedSeconds}
      completed={completed}
      total={total}
      onPress={onPress}
    />
  );
}

/** The "pick up where you left off" card. Deliberately loud: the only urgent thing here. */
function ResumeCard({
  routineName,
  paused,
  elapsedSeconds,
  completed,
  total,
  onPress,
}: {
  routineName: string;
  paused: boolean;
  elapsedSeconds: number;
  completed: number;
  total: number;
  onPress: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const progress = total > 0 ? completed / total : 0;
  const meta: MetaItem[] = [
    { icon: 'timer', label: formatTimer(elapsedSeconds) },
    { icon: 'checkCircle', label: t('workoutTab.setsOfTotal', { done: completed, total }) },
  ];
  return (
    <View style={styles.section}>
      <Card
        tone="accent"
        onPress={onPress}
        accessibilityLabel={t('workoutTab.resumeA11y', {
          name: routineName,
          done: completed,
          total,
        })}
      >
        <Row gap="lg" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row gap="sm" align="center">
              <View
                style={[
                  styles.dot,
                  { backgroundColor: paused ? theme.colors.warning : theme.colors.success },
                ]}
              />
              <Txt variant="micro" uppercase tracking={0.8} weight="700">
                {t(paused ? 'workout.paused' : 'workoutTab.trainingNow')}
              </Txt>
            </Row>
            <Txt variant="title" weight="700" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {routineName}
            </Txt>
            <MetaLine items={meta} theme={theme} style={styles.cardMeta} />
          </View>
          <ProgressRing
            progress={progress}
            theme={theme}
            size={56}
            strokeWidth={6}
            label={`${Math.round(progress * 100)}%`}
          />
        </Row>
      </Card>
    </View>
  );
}

/**
 * The card is not itself a button.
 *
 * A tappable card with a Start button inside it has to swallow the inner press to avoid
 * firing both, and RN's responder system makes that fiddly to get right on Android. Two
 * separate targets: the name block opens, Start starts: is unambiguous to read and to
 * hit, and needs no event plumbing at all.
 */
function LastTrainedCard({ routine, onOpen }: { routine: Routine; onOpen: (id: string) => void }) {
  const { t, locale } = useT();
  const theme = useAppTheme();
  const performedAt = routine.lastPerformedAt ?? routine.createdAt;
  const ago = formatAgoLocalized(performedAt, t, locale);
  const meta: MetaItem[] = [
    { icon: 'calendar', label: ago },
    { icon: 'layers', label: t('workout.exercise', { count: routine.items.length }) },
  ];
  // The card, not the button, shows the refusal: squeezed under a `Start` button the line
  // would be two clipped words, and this is the one case where the button correctly did
  // nothing: it has to be readable, not merely present.
  const [refused, setRefused] = useState(false);
  return (
    <View style={styles.section}>
      <Card>
        <Row gap="lg" align="center">
          <Pressable
            onPress={() => onOpen(routine.id)}
            accessibilityRole="button"
            accessibilityLabel={t('workoutTab.lastTrainedA11y', { name: routine.name, ago })}
            style={styles.lastTrained}
          >
            <MetricLabel label={t('workoutTab.lastTrained')} />
            <Txt variant="subhead" weight="700" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {routine.name}
            </Txt>
            <MetaLine items={meta} theme={theme} style={styles.cardMeta} />
          </Pressable>
          <StartButton routine={routine} onRefused={() => setRefused(true)} />
        </Row>
        {refused ? (
          <Txt variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>
            {t('workoutTab.nothingToTrain')}
          </Txt>
        ) : null}
      </Card>
    </View>
  );
}

/**
 * Starting a workout is a navigation, not a mutation.
 *
 * `startSession` is synchronous over an in-memory store and persists on its own; the session
 * screen reads the same store. `useStartRoutine` owns the whole sequence: the same one the
 * routine screen runs, which is the point: two entry points that build entries slightly
 * differently, or that read a default rest time from different places, is how a user ends up
 * with a different workout depending on which of two identical buttons they happened to tap.
 * It also latches on a ref rather than state, because a double-tap in one frame would
 * otherwise start twice and replace the session that was just created.
 */
function StartButton({ routine, onRefused }: { routine: Routine; onRefused: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { start, busy } = useStartRoutine();

  return (
    <Button
      label={t('workoutTab.start')}
      icon="play"
      size="sm"
      loading={busy}
      onPress={() =>
        start({
          routineId: routine.id,
          routineName: routine.name,
          items: routine.items,
          defaultRestSeconds: defaultRest,
          onResult: (started) => {
            if (started) {
              haptics.success();
              router.push(routes.workoutSession());
              return;
            }
            onRefused();
          },
        })
      }
    />
  );
}

/**
 * Sessions per routine.
 *
 * Deliberately not volume or minutes: those belong on Progress, which derives them from
 * activity history over a date range. The honest question here is *which routines actually
 * get run*, and that is countable from the routine rows themselves: no extra query, and
 * nothing that could disagree with the Progress tab.
 */
function SessionCounts({ routines, width }: { routines: readonly Routine[]; width: number }) {
  const { t } = useT();
  const theme = useAppTheme();
  const points = useMemo<BarPoint[]>(
    () =>
      routines
        .filter((routine) => routine.timesCompleted > 0)
        .slice(0, 6)
        .map((routine) => ({
          label: shortLabel(routine.name),
          value: routine.timesCompleted,
          detail: routine.name,
        })),
    [routines],
  );
  if (points.length < 2 || width <= CARD_PADDING * 2) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('workoutTab.sessionsPerRoutine')}
        eyebrow={t('workoutTab.allTime')}
      />
      <Card>
        <BarChart
          points={points}
          theme={theme}
          width={width - CARD_PADDING * 2}
          height={140}
          format={(value) => `${value}`}
        />
        <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
          {t('workoutTab.sessionsChartNote')}
        </Txt>
      </Card>
    </View>
  );
}

/** Bar labels are a few characters wide; the rest of a routine name belongs in its `detail`. */
function shortLabel(name: string): string {
  const clean = name.replace(/^[\s°]+/, '').trim();
  return clean.length <= 5 ? clean : `${clean.slice(0, 4)}.`;
}

/**
 * One routine row: exercise count, times completed, last performed.
 *
 * Memoised with the id-taking `onOpen`, so a re-render of the tab (a new sort, a routine saved
 * elsewhere) redraws only the rows whose routine changed. `t` is a prop rather than a `tr()`
 * call so a language change reaches a row its memo would otherwise skip.
 *
 * The exercise count stays first: the row's spoken label is "<name>. <items joined>", and the
 * offline gate finds routine rows by the "N exercises ·" at its start.
 */
const RoutineItem = memo(function RoutineItem({
  routine,
  theme,
  t,
  locale,
  first,
  onOpen,
}: {
  routine: Routine;
  theme: Theme;
  t: (key: TKey, vars?: TVars) => string;
  locale: string;
  first: boolean;
  onOpen: (id: string) => void;
}) {
  const meta = useMemo(() => {
    const items: MetaItem[] = [
      { icon: 'layers', label: t('workout.exercise', { count: routine.items.length }) },
    ];
    if (routine.timesCompleted > 0) {
      items.push({ icon: 'checkCircle', label: t('workoutTab.doneTimes', { count: routine.timesCompleted }) });
    }
    if (routine.lastPerformedAt !== null) {
      items.push({ icon: 'calendar', label: formatAgoLocalized(routine.lastPerformedAt, t, locale) });
    }
    return items;
  }, [locale, routine.items.length, routine.lastPerformedAt, routine.timesCompleted, t]);
  const press = useCallback(() => onOpen(routine.id), [onOpen, routine.id]);
  return <RoutineRow routine={routine} theme={theme} meta={meta} topDivider={!first} onPress={press} />;
});

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  intro: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
  section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
  order: { marginBottom: spacing.md },
  cardMeta: { marginTop: spacing.xs },
  lastTrained: { flex: 1, minWidth: 0, paddingVertical: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
} satisfies Record<string, ViewStyle>);
