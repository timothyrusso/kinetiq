/**
 * Workout tab: the front door to training.
 *
 * ## Ordered by what the user is mid-way through
 *
 * Two states, one priority: an in-flight session goes first (it is unfinished and
 * time-sensitive); otherwise "Start empty workout", then the routines. A screen that keeps leading with
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
 * Home owns history. What this tab answers is "which routines do I have, and when did I last
 * do each?", so that lives on the routine rows.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import {
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
import { Txt } from '@/ui/Text';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { ProgressRing } from '@/ui/charts/ProgressRing';
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
import { useStartEmptyWorkout } from '@/workout/startRoutine';
import { useWorkoutRunning, useWorkoutSession } from '@/workout/session';
import { formatAgoLocalized } from '@/utils/relativeTime';

type Order = 'recent' | 'name';

/** Keys, not words: module scope has no language. Resolved where the control renders. */
const ORDER_SEGMENTS: readonly { value: Order; label: TKey }[] = [
  { value: 'recent', label: 'workoutTab.orderRecent' },
  { value: 'name', label: 'workoutTab.orderName' },
];

export default function WorkoutScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();

  const routines = useRoutines();
  const [order, setOrder] = useState<Order>('recent');

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

        {resuming ? <LiveResumeCard onPress={openSession} /> : null}

        {resuming ? null : <StartEmptyWorkout onStarted={openSession} />}

        <View style={styles.section}>
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
 * A session with nothing in it yet: exercises are added from inside the player, which offers
 * the picker while its list is empty. Starting is a navigation, not a mutation: the session
 * store is synchronous and persists on its own, so there is nothing to wait for.
 */
function StartEmptyWorkout({ onStarted }: { onStarted: () => void }) {
  const { t } = useT();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const start = useStartEmptyWorkout();
  const press = useCallback(() => {
    start({ name: t('workoutTab.emptyWorkoutName'), defaultRestSeconds: defaultRest });
    haptics.success();
    onStarted();
  }, [defaultRest, onStarted, start, t]);
  return (
    <View style={styles.section}>
      <SectionHeader title={t('workoutTab.quickStart')} />
      <Button label={t('workoutTab.startEmpty')} icon="plus" variant="secondary" fullWidth onPress={press} />
    </View>
  );
}

/**
 * One routine row: exercise count, times completed, last performed.
 *
 * Memoised with the id-taking `onOpen`, so a re-render of the tab (a new sort, a routine saved
 * elsewhere) redraws only the rows whose routine changed. `t` is a prop rather than a `tr()`
 * call so a language change reaches a row its memo would otherwise skip.
 *
 * The exercise count stays first: the row's spoken label is "<name>. <items joined>", so the
 * count is the first fact VoiceOver reads after the name.
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
  section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
  order: { marginBottom: spacing.md },
  cardMeta: { marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
} satisfies Record<string, ViewStyle>);
