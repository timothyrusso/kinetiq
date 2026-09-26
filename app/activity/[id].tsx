/**
 * Workout detail: one session, read back.
 *
 * Summary, per-exercise set tables, and the records the session set. Nothing else: the
 * volume chart and the provenance block went with the gym-only cut, because the set tables
 * already carry every number either one summarised, and the notes block went because the
 * summary is read, not written.
 *
 * ## Absence is rendered, never invented
 *
 * A bodyweight session has no volume; a session nobody added exercises to has no sets.
 * Every such gap renders a dash plus one line saying why that is normal, rather than a `0`
 * or a section that quietly vanishes and leaves the user wondering whether the app lost
 * their data. That is also why `Metric` takes `value: string | null` rather than a
 * pre-formatted dash: a caller cannot display a missing number without also deciding what
 * to say about it.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { routes } from '@/navigation/nav';

import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { MetaLine, StatTile, TagRow } from '@/ui/display';
import { useScreenContentBottom } from '@/ui/insets';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { Badge, Card, Divider, MetricGrid, Row, Stack as Column } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { Txt } from '@/ui/Text';
import { Icon, ICON_SIZE, IconTile } from '@/ui/icons';
import { ACTIVITY_ICON } from '@/ui/rows';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import {
  useActivity,
  useDeleteActivity,
} from '@/queries/useActivities';
// Record wording lives next to the record query, so this screen and the exercise detail
// cannot drift into calling the same record two different things.
import { RECORD_LABEL, formatRecordValue } from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings/hooks';
import { useT } from '@/i18n/useT';
import { activityDisplay } from '@/domain/display';
import { estimatedOneRepMax } from '@/domain/logic';
import type { Activity, StrengthEntry, StrengthSet } from '@/domain/types';
import { useAppTheme, type Theme } from '@/theme/theme';
import { radius, spacing, screenGutter } from '@/theme/tokens';
import type { UnitSystem } from '@/utils/format';
import {
  compactNumber,
  formatCalories,
  formatDuration,
  formatWeight,
  joinMiddleDot,
  splitMetric,
  weightUnit,
  weightValue,
} from '@/utils/format';
import { fullDateLabel, timeOfDayLabel } from '@/utils/relativeTime';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const theme = useAppTheme();
  const bottom = useScreenContentBottom();
  const units = useSettings((s) => s.unitSystem);

  const activityId = typeof id === 'string' && id.length > 0 ? id : null;
  const query = useActivity(activityId);
  const activity = query.data ?? null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  return (
    <>
      {/* A fade rather than a push: a horizontal slide would flash the previous list's rows
          past the hero number. */}
      <Stack.Screen options={{ animation: 'fade_from_bottom' }} />
      <ScreenHeader title={activity?.title ?? t('activity.fallbackTitle')} />
      {activity ? (
        <HeaderToolbar placement="right">
          {/* Destructive: tinted as danger, and behind the native confirm below. */}
          {headerAction({
            action: 'delete',
            onPress: askDelete,
            t,
            label: 'activity.delete',
            tint: theme.colors.danger,
          })}
        </HeaderToolbar>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md, paddingBottom: bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {query.isPending ? (
          <Column gap="lg">
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
          <ActivityBody activity={activity} units={units} theme={theme} />
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
  theme,
}: {
  activity: Activity;
  units: UnitSystem;
  theme: Theme;
}) {
  const { t } = useT();

  // The spoken sentence comes from the same helper as the list row's headline, so the
  // summary VoiceOver reads and the row it came from cannot disagree about rounding.
  const display = useMemo(
    () => activityDisplay(activity, units),
    [activity, units],
  );
  const when = useMemo(
    () => [
      { icon: 'calendar' as const, label: fullDateLabel(activity.startedAt) },
      { icon: 'clock' as const, label: timeOfDayLabel(activity.startedAt) },
    ],
    [activity.startedAt],
  );

  return (
    <View>
      {/* One accessibility element for the whole hero, so VoiceOver reads "Push. 12.4k kg
          in 52 min" as a sentence rather than fragments in sequence. The label comes from
          the domain layer because that is what decides what is true about the numbers. The
          kind is the tile's glyph, not a word: the title already names it. The tile is the
          accent, like every other workout icon. The volume is not repeated here: it is one
          of the summary tiles below, and a hero that shouts it twice on one screen is noise. */}
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={display.accessibilityLabel}
        style={[styles.hero, { backgroundColor: theme.colors.surface }]}
      >
        <Row gap="md" align="center">
          <IconTile
            name={ACTIVITY_ICON[activity.kind]}
            color={theme.colors.accent}
            background={theme.colors.accentSoft}
          />
          <MetaLine items={when} theme={theme} wrap style={styles.flex} />
        </Row>
      </View>

      {activity.strength ? (
        <StrengthBody activity={activity} units={units} theme={theme} />
      ) : (
        <EmptyState
          style={{ paddingTop: spacing.xxxl }}
          title={t('activity.emptyTitle')}
          message={t('activity.emptyMessage')}
          icon="warning"
          compact
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------- strength -- */

function StrengthBody({
  activity,
  units,
  theme,
}: {
  activity: Activity;
  units: UnitSystem;
  theme: Theme;
}) {
  const { t } = useT();
  const openExercise = useCallback((exerciseId: string) => {
    router.push(routes.exerciseDetail(exerciseId));
  }, []);
  const strength = activity.strength;
  const entries = strength?.entries ?? [];
  const records = strength?.personalRecords ?? [];
  const planned = entries.reduce((total, entry) => total + entry.sets.length, 0);
  const completed = entries.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const volume = strength?.totalVolumeKg ?? 0;
  const unit = weightUnit(units);

  return (
    <>
      <Section gap="lg">
        <SectionHeader title={t('activity.session')} />
        <MetricGrid columns={2}>
          <Metric
            label={t('activity.duration')}
            value={formatDuration(activity.durationSeconds)}
          />
          <Metric
            label={t('activity.volume')}
            value={volume > 0 ? `${compactNumber(weightValue(volume, units))} ${unit}` : null}
            {...(volume > 0 ? {} : { note: t('activity.bodyweightWork') })}
          />
          <Metric
            label={t('activity.sets')}
            value={planned > 0 ? `${completed}/${planned}` : null}
            note={t(planned > 0 ? 'activity.completed' : 'activity.noSets')}
          />
          <Metric
            label={t('activity.exercises')}
            value={entries.length > 0 ? `${entries.length}` : null}
            {...(entries.length > 0 ? {} : { note: t('activity.nothingAdded') })}
          />
          <Metric
            label={t('activity.calories')}
            value={activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null}
            {...(activity.caloriesKcal > 0 ? {} : { note: t('activity.noEstimate') })}
          />
        </MetricGrid>
      </Section>

      <Section>
        <SectionHeader
          title={t('activity.exercises')}
          counter={entries.length}
        />
        {entries.map((entry, index) => (
          <ExerciseCard
            key={`${entry.exerciseId}-${index}`}
            entry={entry}
            units={units}
            theme={theme}
            onOpen={openExercise}
          />
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
                  <Icon name="trophy" size={ICON_SIZE.inline} color={theme.colors.onAccent} />
                  <Column gap="xxs" style={styles.shrink}>
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

/**
 * One exercise's sets. The header is the way into the exercise's own page (its history, its
 * heaviest-weight line, its records): the library is only reached to pick an exercise, so a
 * logged session is where "how is my squat going" starts.
 */
function ExerciseCard({
  entry,
  units,
  theme,
  onOpen,
}: {
  entry: StrengthEntry;
  units: UnitSystem;
  theme: Theme;
  onOpen: (exerciseId: string) => void;
}) {
  const { t } = useT();
  const top = useMemo(() => heaviestCompletedSet(entry.sets), [entry.sets]);
  const done = entry.sets.filter((set) => set.completed).length;
  const planned = entry.sets.length;
  const meta = useMemo(
    () => [
      {
        icon: 'layers' as const,
        label: `${done}/${planned} ${t('activity.setWord', { count: planned })}`,
      },
      ...(top
        ? [
            {
              icon: 'trophy' as const,
              label: t('activity.topSet', {
                weight:
                  top.weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(top.weightKg, units),
                reps: top.reps,
              }),
            },
          ]
        : []),
    ],
    [done, planned, t, top, units],
  );
  const tags = useMemo(
    () => (entry.muscleGroup ? [{ key: 'muscle', label: entry.muscleGroup }] : []),
    [entry.muscleGroup],
  );

  return (
    <Card padding="md">
      <Column gap="md">
        <Row gap="md" align="center">
          <Pressable
            onPress={() => onOpen(entry.exerciseId)}
            accessibilityRole="button"
            accessibilityHint={t('activity.openExerciseHint')}
            style={({ pressed }) => [styles.shrink, pressed ? styles.pressed : null]}
          >
            <Column gap="xs">
              <Row gap="xs" align="center">
                <Txt variant="subhead" weight="700" numberOfLines={2} style={styles.shrink}>
                  {entry.exerciseName}
                </Txt>
                <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
              </Row>
              <MetaLine items={meta} theme={theme} wrap />
              <TagRow tags={tags} theme={theme} />
            </Column>
          </Pressable>
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

/* ---------------------------------------------------------------- pieces -- */

/**
 * One metric cell. The "`null` means unmeasured" contract is the point of the component, * see the file header.
 */
function Metric({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const { t } = useT();
  const missing = value === null;
  // The unit rides beside the numeral ("12.4k" and "kg"), so a two-column grid can hold a
  // value at tile size without truncating it.
  const parts = missing ? { value: '-' } : splitMetric(value);
  return (
    <Column gap="xxs">
      <StatTile label={label} value={parts.value} {...(parts.unit ? { unit: parts.unit } : {})} />
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
 * written before the field existed.
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


const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter },
  hero: { padding: spacing.lg, borderRadius: radius.xl },
  flex: { flex: 1 },
  shrink: { flex: 1, minWidth: 0 },
  section: { paddingTop: spacing.xxxl },
  headRow: { paddingVertical: spacing.xs },
  dataRow: { paddingVertical: spacing.md },
  /** A planned-but-not-done set is part of the record, so it is dimmed rather than hidden. */
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  narrow: { width: 30 },
  wide: { width: 54 },
  cell: { flex: 1 },
});
