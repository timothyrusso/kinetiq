/**
 * Workout tab — the front door to training.
 *
 * ## Ordered by what the user is mid-way through
 *
 * Two states, one priority: an in-flight session goes first (it is unfinished and
 * time-sensitive), then routines, then the library. A screen that keeps leading with
 * "start something new" while a set sits half-completed is asking to be abandoned, so the
 * resume card is not a banner appended to a list — it *is* the first thing on screen.
 *
 * ## A scroll view, not a list
 *
 * Home and Activities use FlashList because their content is unbounded. Here it is bounded
 * twice over: routines are local and a keen lifter has a dozen, and the library preview is
 * six rows by construction. Virtualising that means a recycle pool larger than the content.
 * The scroll view also lets the routine rows sit as plain siblings, which is what the
 * hairline-divider rhythm between them wants.
 *
 * ## The library is previewed, not paged
 *
 * Paging an infinite remote feed inside a `ScrollView` either loads everything or silently
 * stops, and both are worse than a link. Six exercises answer "is the catalog alive?" and
 * the Browse button hands off to the Exercises tab, which owns search, filters and paging.
 *
 * ## Two kinds of training, one front door
 *
 * Routines *and* cardio both start here. The tab used to offer only routines and leave
 * `routes.cardio()` reachable from Profile alone, which buried a whole training mode behind a
 * settings-looking screen. The split is also honest about what the two are: a routine is a plan
 * you follow from a list, cardio is an activity you go out and do, and the entry points read
 * differently for that reason — pick a plan versus put your phone in your pocket.
 *
 * ## No history list
 *
 * Activities owns history. Repeating it here would be a second list with a second sort and
 * no second purpose. What this tab can answer that Activities cannot is "which routines am
 * I actually running, and when did I last do each?" — so that lives on the routine rows.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTabContentBottom } from '@/ui/insets';

import { Button } from '@/ui/Button';
import { Card, Row, SectionHeader } from '@/ui/layout';
import { BarAction, CollapsibleHeader, CollapsibleHero, useScreenHeaderScroll } from '@/ui/Screen';
import { ExerciseThumb, RoutineRow } from '@/ui/rows';
import { SegmentedControl } from '@/ui/controls';
import { MetricLabel, Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { ProgressRing } from '@/ui/charts/ProgressRing';
import { useMeasuredWidth } from '@/ui/charts/Sparkline';
import { BarChart, type BarPoint } from '@/ui/charts/BarChart';
import { useRoutines } from '@/queries/useRoutines';
import { BROWSE_FILTER, useExerciseSearch } from '@/queries/useExercises';
import { routes } from '@/navigation/nav';
import type { Routine } from '@/domain/types';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import { formatAgo, formatTimer } from '@/utils/format';
import { useSettings } from '@/settings';
import { haptics } from '@/services/haptics';
import { useStartRoutine } from '@/workout/startRoutine';
import { useWorkoutSession } from '@/workout/session';

type Order = 'recent' | 'name';

const ORDER_SEGMENTS: readonly { value: Order; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'A–Z' },
];

/** Six is two rows of three on a compact phone and reads as a sample, not a list. */
const LIBRARY_PREVIEW = 6;
/** Clearance for the floating tab bar, which this tab is inside. */
const CARD_PADDING = spacing.lg;
/** Grid columns, fixed rather than measured: three across is legible at every width. */
const GRID_COLUMNS = 3;

export default function WorkoutScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const header = useScreenHeaderScroll();

  const routines = useRoutines();
  const [order, setOrder] = useState<Order>('recent');
  const [sectionWidth, measureSection] = useMeasuredWidth();

  // One card covers both "I am mid-set" and "the app was killed mid-set", because by the time
  // this screen can see either they are the same object: bootstrap restores an unfinished
  // session and immediately pauses it, so a crashed workout arrives as a paused one. There is
  // no separate "recover" state to surface here, and inventing one would mean a second card
  // with a second button pointing at the same session.
  const { session } = useWorkoutSession();
  const resuming = session !== null && (session.status === 'active' || session.status === 'paused');

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

  const library = useExerciseSearch(BROWSE_FILTER);
  const preview = useMemo(() => library.items.slice(0, LIBRARY_PREVIEW), [library.items]);

  const openRoutine = useCallback((id: string) => router.push(routes.routine(id)), [router]);
  const openNewRoutine = useCallback(() => router.push(routes.newRoutine()), [router]);

  const mostRecent = useMemo(() => {
    const trained = routines.routines.filter((r) => r.lastPerformedAt !== null);
    if (trained.length === 0) return null;
    return trained.reduce((a, b) =>
      (b.lastPerformedAt ?? 0) > (a.lastPerformedAt ?? 0) ? b : a,
    );
  }, [routines.routines]);

  const gridWidth = sectionWidth;
  const tileWidth =
    gridWidth > 0
      ? Math.floor((gridWidth - spacing.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
      : 0;

  return (
    <View style={styles.root}>
      <CollapsibleHeader
        header={header}
        title="Workout"
        right={<BarAction icon="plus" label="New routine" onPress={openNewRoutine} />}
      />

      <ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <CollapsibleHero header={header} eyebrow="Train" title="Workout">
          <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            {routines.count === 0
              ? 'Build a routine once, run it forever'
              : `${routines.count} ${routines.count === 1 ? 'routine' : 'routines'} ready to train`}
          </Txt>
        </CollapsibleHero>

        {resuming && session ? (
          <ResumeCard
            routineName={session.routineName}
            paused={session.status === 'paused'}
            elapsedSeconds={session.elapsedSeconds}
            completed={session.entries.reduce(
              (n, entry) => n + entry.sets.filter((set) => set.completed).length,
              0,
            )}
            total={session.entries.reduce((n, entry) => n + entry.sets.length, 0)}
            onPress={() => router.push(routes.workoutSession())}
          />
        ) : null}

        {mostRecent && !resuming ? (
          <LastTrainedCard
            routine={mostRecent}
            onOpen={() => openRoutine(mostRecent.id)}
          />
        ) : null}

        {/* After the "continue" affordances and before the archive of plans, because it is a
            third way to train rather than the most likely one: nobody returns to this tab
            mid-session looking for the recorder, but nobody finds it under Profile either. */}
        <CardioCard onPress={() => router.push(routes.cardio())} style={styles.section} />

        <View style={styles.section} onLayout={measureSection}>
          <SectionHeader
            title="Your routines"
            eyebrow="Saved"
            {...(routines.count > 0 ? { count: routines.count } : {})}
            action={
              <Button
                label="New"
                size="sm"
                variant="secondary"
                icon="plus"
                onPress={openNewRoutine}
              />
            }
          />
          {routines.routines.length > 1 ? (
            <SegmentedControl
              segments={ORDER_SEGMENTS}
              value={order}
              onChange={setOrder}
              style={{ marginBottom: spacing.md }}
            />
          ) : null}

          {routines.isLoading ? (
            <SkeletonCard lines={2} />
          ) : routines.error ? (
            <ErrorState
              error={routines.error}
              onRetry={() => void routines.refresh()}
              title="Could not open your routines"
            />
          ) : routines.isEmpty ? (
            <EmptyState
              title="No routines yet"
              message="Pick a few exercises, set your reps and weights, and the next six weeks sort themselves out."
              icon="dumbbell"
              actionLabel="Create a routine"
              onAction={openNewRoutine}
              compact
            />
          ) : (
            <View>
              {sorted.map((routine, index) => (
                <RoutineRow
                  key={routine.id}
                  routine={routine}
                  theme={theme}
                  subtitle={routineSubtitle(routine)}
                  topDivider={index > 0}
                  onPress={() => openRoutine(routine.id)}
                />
              ))}
            </View>
          )}
        </View>

        <LibraryPreview
          loading={library.isLoading}
          failed={library.error !== null}
          exercises={preview.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            // `thumbUriOf` is for stored snapshots; a search hit is a live `Exercise`.
            uri: exercise.thumbnailUrl ?? exercise.imageUrl,
          }))}
          tileWidth={tileWidth}
          onOpen={(id) => router.push(routes.exerciseDetail(id))}
          onBrowse={() => router.push(routes.exercisesTab())}
        />

        <SessionCounts routines={routines.routines} width={gridWidth} />
      </ScrollView>
    </View>
  );
}

/** The "pick up where you left off" card. Deliberately loud — the only urgent thing here. */
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
  const theme = useAppTheme();
  const progress = total > 0 ? completed / total : 0;
  return (
    <View style={styles.section}>
      <Card
        tone="accent"
        onPress={onPress}
        accessibilityLabel={`${routineName} in progress. ${completed} of ${total} sets done. Resume.`}
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
                {paused ? 'Paused' : 'Training now'}
              </Txt>
            </Row>
            <Txt variant="title" weight="700" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {routineName}
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xxs }}>
              {formatTimer(elapsedSeconds)} · {completed}/{total} sets
            </Txt>
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
 * separate targets — the name block opens, Start starts — is unambiguous to read and to
 * hit, and needs no event plumbing at all.
 */
function LastTrainedCard({ routine, onOpen }: { routine: Routine; onOpen: () => void }) {
  const performedAt = routine.lastPerformedAt ?? routine.createdAt;
  // The card, not the button, shows the refusal: squeezed under a `Start` button the line
  // would be two clipped words, and this is the one case where the button correctly did
  // nothing — it has to be readable, not merely present.
  const [refused, setRefused] = useState(false);
  return (
    <View style={styles.section}>
      <Card>
        <Row gap="lg" align="center">
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${routine.name}, last trained ${formatAgo(performedAt)}. Opens the routine.`}
            style={{ flex: 1, minWidth: 0, paddingVertical: spacing.xs }}
          >
            <MetricLabel label="Last trained" />
            <Txt variant="subhead" weight="700" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {routine.name}
            </Txt>
            <Txt variant="caption" tone="muted">
              {formatAgo(performedAt)} · {routine.items.length}{' '}
              {routine.items.length === 1 ? 'exercise' : 'exercises'}
            </Txt>
          </Pressable>
          <StartButton routine={routine} onRefused={() => setRefused(true)} />
        </Row>
        {refused ? (
          <Txt variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>
            Nothing to train yet — open this routine and add an exercise.
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
 * screen reads the same store. `useStartRoutine` owns the whole sequence — the same one the
 * routine screen runs, which is the point: two entry points that build entries slightly
 * differently, or that read a default rest time from different places, is how a user ends up
 * with a different workout depending on which of two identical buttons they happened to tap.
 * It also latches on a ref rather than state, because a double-tap in one frame would
 * otherwise start twice and replace the session that was just created.
 */
function StartButton({ routine, onRefused }: { routine: Routine; onRefused: () => void }) {
  const router = useRouter();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { start, busy } = useStartRoutine();

  return (
    <Button
      label="Start"
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
 * The cardio front door.
 *
 * A different shape from the routine rows on purpose: a routine is chosen, cardio is begun, so
 * this is one large target with the activity kinds named on it rather than a row with a button
 * on the right. It also carries the "why is distance sometimes estimated" line in one place —
 * better here, where it is read before a session, than on the results screen, where it is
 * read after one.
 */
function CardioCard({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <View style={style}>
      <SectionHeader title="Record an activity" eyebrow="Outdoors" />
      <Card tone="flat" onPress={onPress} accessibilityLabel="Record a run, ride or walk. Opens the recorder.">
        <Row gap="lg" align="center">
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.accentSoft },
            ]}
          >
            <Icon name="play" size={20} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="subhead" weight="700">
              Run, ride or walk
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xxs }}>
              Traces a route while you move. Keeps going with the phone locked.
            </Txt>
          </View>
          <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />
        </Row>
      </Card>
    </View>
  );
}

function LibraryPreview({
  loading,
  failed,
  exercises,
  tileWidth,
  onOpen,
  onBrowse,
}: {
  loading: boolean;
  failed: boolean;
  exercises: readonly { id: string; name: string; uri: string | null }[];
  tileWidth: number;
  onOpen: (id: string) => void;
  onBrowse: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Exercise library"
        eyebrow="Live from wger"
        action={
          <Button
            label="Browse"
            size="sm"
            variant="quiet"
            trailingIcon="chevronRight"
            onPress={onBrowse}
          />
        }
      />
      {loading ? (
        <SkeletonCard lines={1} />
      ) : failed ? (
        <Txt variant="caption" tone="muted">
          The catalog is remote, so browsing needs a connection. Your saved routines are
          unaffected — each one carries its own frozen copy of every exercise in it.
        </Txt>
      ) : (
        <View style={styles.grid}>
          {exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              accessibilityLabel={`${exercise.name}. Opens the exercise.`}
              onPress={() => onOpen(exercise.id)}
              style={({ pressed }) => [
                styles.tile,
                tileWidth > 0 ? { width: tileWidth } : styles.tileFlex,
                {
                  backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <ExerciseThumb uri={exercise.uri} name={exercise.name} size={44} theme={theme} />
              <Txt variant="micro" weight="600" numberOfLines={2} style={{ marginTop: spacing.sm }}>
                {exercise.name}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Sessions per routine.
 *
 * Deliberately not volume or minutes — those belong on Progress, which derives them from
 * activity history over a date range. The honest question here is *which routines actually
 * get run*, and that is countable from the routine rows themselves: no extra query, and
 * nothing that could disagree with the Progress tab.
 */
function SessionCounts({ routines, width }: { routines: readonly Routine[]; width: number }) {
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
      <SectionHeader title="Sessions per routine" eyebrow="All time" />
      <Card>
        <BarChart
          points={points}
          theme={theme}
          width={width - CARD_PADDING * 2}
          height={140}
          format={(value) => `${value}`}
        />
        <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
          How often each routine gets run, since you started tracking.
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

function routineSubtitle(routine: Routine): string {
  const parts = [`${routine.items.length} ${routine.items.length === 1 ? 'exercise' : 'exercises'}`];
  if (routine.timesCompleted > 0) parts.push(`${routine.timesCompleted}× done`);
  if (routine.lastPerformedAt !== null) parts.push(formatAgo(routine.lastPerformedAt));
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  tileFlex: { width: '31%' },
} satisfies Record<string, ViewStyle>);
