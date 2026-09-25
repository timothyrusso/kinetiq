/**
 * A saved routine: the plan, and the controls around it.
 *
 * Reached from the Workout tab, the routines list, the workout picker and: via `replace`, * from the builder that just created it. `routine/_layout.tsx` registers this one as a card
 * rather than a modal so the browse → open → train → back loop keeps the stack underneath it.
 *
 * ## Every edit writes on change, and there is no Done button
 *
 * The builder saves once, at the end, because a half-built routine is not worth keeping. This
 * screen is the opposite case: the routine already exists on disk, so a row the user changed
 * and then navigated away from must be changed. "Save" on a screen whose every control has
 * already taken effect would be a button that lies about what it does. So the steppers write
 * straight through `useSetRoutineItem`, and the only confirmation on this screen stands in
 * front of deleting something.
 *
 * ## What "offline" means here
 *
 * Everything on this screen comes from SQLite. The exercises were frozen into the local
 * `exercises` table when they were added (`useAddRoutineExercise` → `snapshotOf`), so with no
 * network this screen renders the same: names, thumbnails, muscle groups, instructions. It
 * makes no request to the exercise API, ever, and there is no pull-to-refresh, because there
 * is nothing remote to refresh. Opening a routine on a plane is not a degraded mode; it is the
 * normal mode. The one place a network is needed is adding a *new* exercise, and the picker
 * sheet says so in its own error state.
 *
 * ## Previous performance lives on the session screen, not here
 *
 * It would be reasonable to print "last time: 3 × 95 kg" beside each row, and it deliberately
 * is not here. That number is already rendered where it is used: while the set is being
 * entered, in `app/workout/session.tsx`: and computing it means scanning the last 24 workouts.
 * A plan screen that reads 24 activities to decorate itself gets slower as history grows, for a
 * number the user is not deciding anything with yet. `timesCompleted` and `lastPerformedAt` are
 * columns on the routine this screen already loads, so it still says when the routine was last
 * trained, in one indexed read.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { routes } from '@/navigation/nav';
import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { MetaLine, StatTile, type MetaItem } from '@/ui/display';
import {
  HeaderToolbar,
  headerAction,
  headerMenu,
  type HeaderMenuItem,
} from '@/navigation/HeaderAction';
import { Button } from '@/ui/controls/Button';
import { Card, Row, Stack as Column } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { Txt } from '@/ui/Text';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { EmptyState, ErrorState, SkeletonList } from '@/ui/states';
import { RoutineItemRow } from '@/ui/routineItems';
import { useScreenContentBottom } from '@/ui/insets';
import {
  useDeleteRoutine,
  useDuplicateRoutine,
  useRemoveRoutineItem,
  useReorderRoutine,
  useRoutine,
} from '@/queries/useRoutines';
import { useSettings } from '@/settings';
import { useT } from '@/i18n/useT';
import type { TKey, TVars } from '@/i18n';
import { useStartRoutine } from '@/workout/startRoutine';
import { useWorkoutSession } from '@/workout/session';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import { moveItem } from '@/utils/functional';
import { orderedIdsOf, pairItems } from '@/routines/draft';
import { estimateMinutes, plannedVolumeKg } from '@/domain/logic';
import { compactNumber, weightUnit, weightValue } from '@/utils/format';
import { agoLabel } from '@/utils/relativeTime';

type SheetKind = 'delete' | null;

export default function RoutineDetailScreen() {
  const { t } = useT();
  const theme = useAppTheme();
  const bottom = useScreenContentBottom();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;

  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routine, snapshots, missing, isLoading, error, refresh } = useRoutine(id);
  const { session } = useWorkoutSession();

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const reorder = useReorderRoutine();
  const removeItem = useRemoveRoutineItem();
  const duplicate = useDuplicateRoutine();
  const destroy = useDeleteRoutine();
  const { start, busy: starting } = useStartRoutine();

  const items = routine?.items ?? [];
  const rows = useMemo(() => pairItems(items, snapshots), [items, snapshots]);
  // A stable identity for "which exercises are in here", so the picker's `isIncluded` does not
  // change on every render and re-run the hook's memo.

  const volumeKg = useMemo(() => plannedVolumeKg(items), [items]);
  const minutes = useMemo(() => estimateMinutes(items), [items]);

  /**
   * A workout is already running.
   *
   * Any session, not only one started from this routine. Two live sessions would mean two rest
   * timers and two elapsed clocks, and the store holds one at a time, so starting a second
   * would silently replace the first: destroying a workout the user is mid-way through. The
   * honest answer is to send them to the session that exists.
   */
  const liveSession =
    session !== null && (session.status === 'active' || session.status === 'paused');

  const begin = useCallback(() => {
    if (routine === null) return;
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
        setFailed(t('routine.noExercisesYet'));
        haptics.warning();
      },
    });
  }, [defaultRest, routine, start, t]);

  const move = useCallback(
    (from: number, to: number) => {
      if (routine === null) return;
      // The whole list rather than a from/to pair: see `useReorderRoutine`. The ids come from
      // the rows on screen, which is what the user was looking at when they tapped.
      void reorder
        .mutateAsync({ id: routine.id, orderedItemIds: orderedIdsOf(moveItem(items, from, to)) })
        .catch(() => {
          setFailed(t('routine.reorderFailed'));
          haptics.warning();
        });
      haptics.selection();
    },
    [items, reorder, routine, t],
  );

  const dropItem = useCallback(
    (itemId: string) => {
      if (routine === null) return;
      setSheet(null);
      haptics.light();
      void removeItem.mutateAsync({ routineId: routine.id, itemId }).catch(() => {
        setFailed(t('routine.removeFailed'));
        haptics.warning();
      });
    },
    [removeItem, routine, t],
  );

  const doDuplicate = useCallback(() => {
    if (routine === null) return;
    void duplicate
      .mutateAsync({ id: routine.id, name: `${routine.name} copy` })
      .then((copy) => {
        setSheet(null);
        haptics.success();
        // `replace`, not `push`: you are looking at the copy now. Pushing would leave the
        // original underneath, so a back gesture lands on a screen whose Duplicate button would
        // then make a third routine.
        router.replace(routes.routine(copy.id));
      })
      .catch(() => {
        setFailed(t('routine.duplicateFailed'));
        haptics.warning();
      });
  }, [duplicate, routine, t]);

  const doDelete = useCallback(() => {
    if (routine === null) return;
    void destroy
      .mutateAsync(routine.id)
      .then(() => {
        setSheet(null);
        haptics.medium();
        // Back where they came from, except when this screen *is* the entry point: a deep link
        // from a notification has nothing to return to, and a back button that does nothing is
        // worse than landing on the tab that lists routines.
        if (router.canGoBack()) router.back();
        else router.replace(routes.workoutTab());
      })
      .catch(() => {
        setFailed(t('routine.deleteFailed'));
        haptics.warning();
      });
  }, [destroy, routine, t]);

  const optionItems = useMemo<HeaderMenuItem[]>(
    () => [
      {
        key: 'rename',
        label: t('routine.rename'),
        sf: 'pencil',
        onPress: () => {
          if (routine) router.push(routes.renameRoutine(routine.id));
        },
      },
      {
        key: 'duplicate',
        label: t('routine.duplicate'),
        sf: 'plus.square.on.square',
        onPress: () => void doDuplicate(),
      },
      {
        key: 'delete',
        label: t('routine.deleteRoutine'),
        sf: 'trash',
        destructive: true,
        onPress: () => setSheet('delete'),
      },
    ],
    [doDuplicate, routine, t],
  );
  const startRoutine = useCallback(() => {
    if (liveSession) {
      reportLiveSession(session?.routineName, setFailed, t);
      return;
    }
    begin();
  }, [begin, liveSession, session?.routineName, t]);
  // Context, as items: what is in the routine and when it last ran. The numbers the screen is
  // about (volume, time, how often) are the stat tiles below, so nothing is said twice.
  const lastPerformedAt = routine?.lastPerformedAt ?? null;
  const summary = useMemo<MetaItem[]>(
    () => [
      { icon: 'layers', label: `${items.length} ${t('routine.exerciseWord', { count: items.length })}` },
      ...(volumeKg === 0 && items.length > 0
        ? [{ icon: 'dumbbell' as const, label: t('routine.bodyweight') }]
        : []),
      ...(lastPerformedAt === null
        ? []
        : [
            {
              icon: 'calendar' as const,
              label: t('details.lastTrained', { ago: agoLabel(lastPerformedAt) }),
            },
          ]),
    ],
    [items.length, lastPerformedAt, t, volumeKg],
  );

  // One callback per action, shared by every row: the row passes its own id or index back.
  const routineId = routine?.id ?? null;
  const openItem = useCallback(
    (itemId: string) => {
      if (routineId !== null) router.push(routes.routineItem('routine', itemId, routineId));
    },
    [routineId],
  );
  const addExercise = useCallback(() => {
    if (routine === null) return;
    haptics.light();
    router.push(routes.pickExercise('routine', routine.id));
  }, [routine]);
  const primary = useCallback(() => {
    if (liveSession) {
      router.push(routes.workoutSession());
      return;
    }
    begin();
  }, [begin, liveSession]);

  /* ------------------------------------------------------------ early states */

  if (isLoading) {
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
          <View
            style={{ flex: 1, paddingHorizontal: screenGutter, paddingTop: spacing.md }}
          >
            <SkeletonList rows={6} />
          </View>
      </>
    );
  }

  if (error !== null) {
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: screenGutter }}>
            <ErrorState
              error={error}
              onRetry={() => void refresh()}
              title={t('routine.readError')}
            />
          </View>
      </>
    );
  }

  if (routine === null || missing) {
    // Distinct from loading, and distinct from an error: the read succeeded and there is
    // nothing there. That happens when the row was deleted elsewhere while this screen was
    // open, and it needs a way out rather than a spinner that never ends.
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: screenGutter }}>
            <EmptyState
              icon="listAdd"
              title={t('routine.goneTitle')}
              message={t('routine.goneMessage')}
              actionLabel={t('routine.backToWorkouts')}
              onAction={() => router.replace(routes.workoutTab())}
            />
          </View>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title={routine.name} />
      <HeaderToolbar placement="right">
        {headerMenu({ action: 'more', t, label: 'routine.options', items: optionItems })}
        {headerAction({ action: 'play', onPress: startRoutine, t, label: 'routine.start' })}
      </HeaderToolbar>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      >
        <Column gap="lg" style={styles.gutter}>
          <MetaLine items={summary} theme={theme} wrap />

          <View style={styles.stats}>
            {/* A bodyweight routine has no volume to state; the summary line says so instead
                of a tile holding a word where a number belongs. */}
            {volumeKg === 0 ? null : (
              <StatTile
                label={t('routine.plannedVolume')}
                value={compactNumber(weightValue(volumeKg, units))}
                unit={weightUnit(units)}
              />
            )}
            <StatTile label={t('routine.estTime')} value={`~${minutes}`} unit="min" />
            <StatTile label={t('routine.trained')} value={`${routine.timesCompleted}×`} />
          </View>

          {failed !== null ? (
            <Card tone="sunken" padding="md">
              <Row gap="sm" align="start">
                <Icon name="warning" size={ICON_SIZE.inline} color={theme.colors.warning} />
                <Txt variant="body" style={styles.flex}>
                  {failed}
                </Txt>
              </Row>
            </Card>
          ) : null}
        </Column>

        {rows.length === 0 ? (
          <EmptyState
            icon="listAdd"
            title={t('routine.emptyTitle')}
            message={t('routine.emptyMessage')}
            actionLabel={t('exercises.addExercise')}
            onAction={addExercise}
          />
        ) : (
          <Column gap="md">
            <SectionHeader
              style={styles.gutter}
              title={t('routine.exercises')}
              eyebrow={`${rows.length} ${t('routine.rowWord', { count: rows.length })}`}
              action={{ label: t('common.add'), onPress: addExercise }}
            />
            {/* No Card: `ListRow` carries its own horizontal padding and hairline, so a
                bordered box around it would inset the dividers short of the edges. */}
            <View>
              {rows.map((row, index) => (
                <RoutineItemRow
                  key={row.item.id}
                  item={row.item}
                  snapshot={row.snapshot}
                  units={units}
                  theme={theme}
                  index={index}
                  count={rows.length}
                  onOpen={openItem}
                  onMove={move}
                  onRemove={dropItem}
                />
              ))}
            </View>
          </Column>
        )}

        {/* In content as well as in the header: a thumb looks for it at the end of the plan,
            where the decision to train is made. */}
        <View style={styles.gutter}>
          <Button
            label={t(liveSession ? 'routine.openWorkout' : 'routine.start')}
            icon={liveSession ? 'arrowUpRight' : 'play'}
            size="lg"
            weighty
            fullWidth
            loading={starting}
            onPress={primary}
            accessibilityHint={t(liveSession ? 'routine.openHint' : 'routine.startHint')}
          />
        </View>
      </ScrollView>

      {sheet === 'delete' ? (
        <ConfirmDialog
          visible
          title={t('routine.deleteTitle', { name: routine.name })}
          message={
            routine.timesCompleted > 0
              ? t('routine.deleteCompleted', {
                  count: routine.timesCompleted,
                  word: t('routine.timeWord', { count: routine.timesCompleted }),
                })
              : t('routine.deleteNever')
          }
          confirmLabel={t('routine.deleteRoutine')}
          cancelLabel={t('common.cancel')}
          destructive
          onCancel={() => setSheet(null)}
          onConfirm={doDelete}
        />
      ) : null}

    </>
  );
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * The message for "you already have a workout running".
 *
 * Names the routine that is live when the store can say it. "A workout is in progress" is true
 * and useless; the user's next question is *which one*, and the answer is already in the store.
 */
function reportLiveSession(
  routineName: string | undefined,
  setFailed: (message: string) => void,
  t: (key: TKey, vars?: TVars) => string,
): void {
  setFailed(
    routineName ? t('routine.liveNamed', { name: routineName }) : t('routine.liveUnnamed'),
  );
  haptics.warning();
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, gap: spacing.xxl },
  gutter: { paddingHorizontal: screenGutter },
  stats: { flexDirection: 'row', gap: spacing.lg },
  flex: { flex: 1 },
});
