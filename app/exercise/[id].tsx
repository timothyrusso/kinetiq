/**
 * Exercise detail: what the library says about one movement, and what *you* have
 * done with it.
 *
 * ## The screen is a provenance report as much as a description
 *
 * An exercise id arrives from a search row, a routine item, a set in the history, or a
 * deep link, and the app's knowledge differs by route: a search row carries a video URL
 * the store never kept; a stored snapshot carries everything except that video; an
 * exercise never seen before needs the network or it needs nothing at all. So one line
 * under the hero says which of those the user is looking at. That is not decoration, * "Offline copy saved 12 May" explains why there is no video before the user goes looking
 * for one, and it gives the "check for updates" button a purpose instead of a mystery.
 *
 * ## Nothing is inferred to fill a gap
 *
 * wger returns no description for a large share of its catalog, and the seeded exercises
 * deliberately have none either. That renders as a named silence, "the library has no
 * description for this one": rather than a blank card, an invented cue, or a section
 * that quietly vanishes. The same rule governs the anatomy caveat, the missing art (a
 * designed monogram, never a grey square), and an empty records list.
 *
 * ## Art is the header, not a section
 *
 * A full-width image at the top, under a transparent bar like an activity's map, but not
 * behind it: a map loses nothing under the bar's material, a technical drawing loses the
 * part of the movement it is drawn to show. So the drawing starts where the bar ends and is
 * fitted whole, never cropped, and the bar floats over plain page until the user scrolls.
 * With no art, the slot keeps roughly the same proportions and holds a composition instead:
 * the layout never changes shape between the two states, so an exercise without a picture
 * doesn't look broken.
 *
 * ## Chips are labels
 *
 * Muscle and equipment chips name the taxonomy and go nowhere: the library is reached only to
 * pick an exercise, so there is no browsing surface for a chip to open.
 */
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

import { ScreenHeader } from '@/ui/Screen';
import { useScreenContentBottom, useTransparentHeaderInset } from '@/ui/insets';
import { Badge, Card, Gap, Row, Stack as Column } from '@/ui/layout';
import { MetaLine, SectionHeader, StatTile, TagRow, type Tag } from '@/ui/display';
import { Txt } from '@/ui/Text';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { ActionRow } from '@/ui/rows';
import { ExerciseRow, ExerciseThumb, ListRow } from '@/ui/rows';
import { EmptyState, ErrorState, SkeletonCard } from '@/ui/states';
import { LineChart, type LinePoint } from '@/ui/charts/LineChart';
import {
  useExerciseResolution,
  useExerciseVariations,
} from '@/queries/useExercises';
import {
  RECORD_LABEL,
  formatRecordValue,
  useExerciseHistory,
  type ExercisePerformance,
} from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings/hooks';
import { provisionalExerciseName } from '@/domain/exerciseId';
import { routes } from '@/navigation/nav';
import { useAppTheme, type Theme } from '@/theme/theme';
import { radius, screenGutter, spacing } from '@/theme/tokens';
import {
  compactNumber,
  formatWeight,
  weightUnit,
  weightValue,
  type UnitSystem,
} from '@/utils/format';
import { agoLabel, formatShortDateLocalized, shortDateLabel } from '@/utils/relativeTime';
import { useT } from '@/i18n/useT';
import type { Exercise } from '@/domain/types';

/** History rows shown before the "most recent N of M" note. */
const HISTORY_PREVIEW = 6;

/** Height of the art slot BELOW the floating bar. Deliberately taller than an activity's
    map: wger's illustrations are small technical drawings, and they need the room to be
    legible. */
const ART_HEIGHT = 260;

/** The no-art composition's height below the bar: close enough to `ART_HEIGHT` that switching
    between an exercise with art and one without does not move the content below the fold. */
const NO_ART_HEIGHT = 270;

export default function ExerciseDetailScreen() {
  const { t, locale } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const bottom = useScreenContentBottom();
  const units = useSettings((s) => s.unitSystem);

  const exerciseId = typeof id === 'string' && id.length > 0 ? id : null;
  const detail = useExerciseResolution(exerciseId);
  const exercise = detail.exercise;
  const history = useExerciseHistory(exerciseId);
  const variations = useExerciseVariations(exercise);

  // An exercise that cannot be resolved has nothing to show, so its one way on is back.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home());
  }, []);

  // Taxonomy as tags. Built here, once per exercise, rather than per render.
  const primaryTags = useMemo<Tag[]>(
    () =>
      (exercise?.primaryMuscles ?? []).map((name) => ({
        key: `p:${name}`,
        label: name,
        tone: 'accent',
      })),
    [exercise],
  );
  const secondaryTags = useMemo<Tag[]>(
    () =>
      (exercise?.secondaryMuscles ?? []).map((name) => ({
        key: `s:${name}`,
        label: name,
      })),
    [exercise],
  );
  const equipmentTags = useMemo<Tag[]>(
    () =>
      (exercise?.equipment ?? []).map((name) => ({
        key: `e:${name}`,
        label: name,
      })),
    [exercise],
  );
  // Heaviest completed set per session, in the user's units. Built here, once per history
  // change, so the chart receives stable points rather than a fresh array per render.
  const weightChart = useMemo(() => {
    const trend = history.history.weightTrend;
    const points: LinePoint[] = trend.map((point) => ({
      key: point.activityId,
      label: formatShortDateLocalized(point.performedAt, locale),
      value: point.weightKg,
    }));
    const first = trend[0];
    const last = trend.at(-1);
    const a11y =
      first && last
        ? t('exerciseDetail.weightChartA11y', {
            count: trend.length,
            first: formatWeight(first.weightKg, units),
            last: formatWeight(last.weightKg, units),
          })
        : '';
    return { points, a11y };
  }, [history.history.weightTrend, locale, t, units]);
  const formatChartWeight = useCallback((kg: number) => formatWeight(kg, units), [units]);

  const openSession = useCallback((activityId: string) => {
    router.push(routes.activityDetail(activityId));
  }, []);

  const externalUrl = useMemo(() => {
    if (exercise?.externalId === null || exercise?.externalId === undefined) return null;
    return `https://wger.de/en/exercise/${exercise.externalId}/`;
  }, [exercise]);

  const title =
    exercise?.name ??
    (exerciseId === null ? t('exerciseDetail.fallbackTitle') : provisionalExerciseName(exerciseId));

  const transparent = exercise?.imageUrl != null;
  const transparentInset = useTransparentHeaderInset();
  const topInset = transparent ? transparentInset : 0;

  return (
    <>
      {/* Fade, matching the activity detail: this screen is pushed from four places and
          its hero is full-bleed media: a horizontal slide would drag the previous
          list's thumbnails across the photo. */}
      <Stack.Screen options={{ animation: 'fade_from_bottom' }} />
      <ScreenHeader title={title} transparent={transparent} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        {detail.isLoading ? (
          <Column gap="lg" style={[styles.section, { paddingTop: topInset + spacing.xl }]}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={5} />
          </Column>
        ) : exercise === null ? (
          <View style={{ paddingTop: topInset + spacing.xl }}>
            {detail.error !== null ? (
              <ErrorState
                error={detail.error}
                onRetry={detail.retry}
                title={t('exerciseDetail.loadError')}
              />
            ) : (
              <EmptyState
                icon="info"
                title={t('exerciseDetail.unknownTitle')}
                message={t(
                  detail.fetchable
                    ? 'exerciseDetail.unknownFetchable'
                    : 'exerciseDetail.unknownBuiltIn',
                )}
                actionLabel={t(
                  detail.fetchable ? 'common.retry' : 'exerciseDetail.backToLibrary',
                )}
                onAction={detail.fetchable ? detail.retry : goBack}
              />
            )}
          </View>
        ) : (
          <Column gap="xxl">
            <Hero exercise={exercise} topInset={topInset} />

            <Column gap="md" style={styles.section}>
              <Provenance
                from={detail.from}
                storedAt={detail.stored?.capturedAt ?? null}
                isFetching={detail.isFetching}
                onRetry={detail.retry}
                externalUrl={externalUrl}
              />
            </Column>

            {primaryTags.length + secondaryTags.length > 0 ? (
              <Column gap="md" style={styles.section}>
                <SectionHeader title={t('exerciseDetail.muscles')} />
                <TagGroup label={t('exerciseDetail.primary')} tags={primaryTags} theme={theme} />
                <TagGroup label={t('exerciseDetail.alsoWorked')} tags={secondaryTags} theme={theme} />
                {secondaryTags.length > 0 ? (
                  <Txt variant="caption" tone="faint">
                    {t('misc.muscleTagging')}
                  </Txt>
                ) : null}
              </Column>
            ) : null}

            {equipmentTags.length > 0 ? (
              <Column gap="md" style={styles.section}>
                <SectionHeader title={t('exerciseDetail.equipment')} />
                <TagRow tags={equipmentTags} theme={theme} />
              </Column>
            ) : null}

            <Column gap="md" style={styles.section}>
              <SectionHeader title={t('exerciseDetail.howTo')} />
              {exercise.instructions === null || exercise.instructions.length === 0 ? (
                <Card tone="sunken">
                  <Row gap="md" align="start">
                    <Icon name="info" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
                    <Txt variant="body" tone="muted" style={styles.flex}>
                      {t(
                        detail.from === 'stored'
                          ? 'exerciseDetail.noDescriptionOffline'
                          : 'exerciseDetail.noDescription',
                      )}
                    </Txt>
                  </Row>
                </Card>
              ) : (
                <Card>
                  <Txt variant="bodyLg">{exercise.instructions}</Txt>
                </Card>
              )}
            </Column>

            <Column gap="lg" style={styles.section}>
              <SectionHeader
                title={t('exerciseDetail.yourHistory')}
                eyebrow={
                  history.history.sessionsCount > 0
                    ? t('exerciseDetail.sessionCount', {
                        count: history.history.sessionsCount,
                      })
                    : undefined
                }
              />
              {history.isLoading ? (
                <SkeletonCard lines={2} />
              ) : history.history.sessionsCount === 0 ? (
                <Card tone="sunken">
                  <Row gap="md" align="center">
                    <Icon name="target" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
                    <Txt variant="body" tone="muted" style={styles.flex}>
                      {t('exerciseDetail.neverLogged')}
                    </Txt>
                  </Row>
                </Card>
              ) : (
                <>
                  {history.history.lastPerformedAt === null ? null : (
                    <MetaLine
                      items={[
                        {
                          icon: 'calendar',
                          label: t('details.lastPerformedAgo', {
                            ago: agoLabel(history.history.lastPerformedAt),
                          }),
                        },
                      ]}
                      theme={theme}
                    />
                  )}
                  <View style={styles.stats}>
                    <StatTile
                      label={t('exerciseDetail.totalVolume')}
                      value={compactNumber(weightValue(history.history.totalVolumeKg, units))}
                      unit={weightUnit(units)}
                    />
                    <StatTile
                      label={t('exerciseDetail.setsDone')}
                      value={String(history.history.totalSets)}
                    />
                  </View>
                  {/* Two points is the least that makes a line; one session is a dot, and the
                      set above already says what it was. */}
                  {weightChart.points.length >= 2 ? (
                    <Card>
                      <SectionHeader
                        title={t('exerciseDetail.heaviestWeight')}
                        eyebrow={t('exerciseDetail.perSession')}
                        style={styles.chartTitle}
                      />
                      <LineChart
                        points={weightChart.points}
                        theme={theme}
                        format={formatChartWeight}
                        accessibilityLabel={weightChart.a11y}
                      />
                    </Card>
                  ) : null}
                </>
              )}
            </Column>

            {!history.isLoading && history.history.sessionsCount > 0 ? (
              // Not wrapped in `styles.section`: these rows carry their own
              // horizontal inset, and the section's padding would double it.
              <View>
                {history.history.sessions.slice(0, HISTORY_PREVIEW).map((session, i) => (
                  <HistoryRow
                    key={session.activityId}
                    session={session}
                    units={units}
                    theme={theme}
                    topDivider={i > 0}
                    onOpen={openSession}
                  />
                ))}
                {history.history.sessions.length > HISTORY_PREVIEW ? (
                  <View style={styles.bandFooter}>
                    <Txt variant="caption" tone="faint">
                      {t('exerciseDetail.earlierSessions', {
                        count: history.history.sessionsCount - HISTORY_PREVIEW,
                      })}
                    </Txt>
                  </View>
                ) : null}
              </View>
            ) : null}

            {history.records.length > 0 ? (
              <Column gap="md" style={styles.section}>
                <SectionHeader
                  title={t('exerciseDetail.records')}
                  eyebrow={t('exerciseDetail.personalBests')}
                />
                <Card tone="accent">
                  <Column gap="lg">
                    {history.records.map((record) => (
                      <Row key={record.kind} gap="md" align="center">
                        <Icon name="trophy" size={ICON_SIZE.inline} color={theme.colors.onAccent} />
                        <Txt variant="label" tone="muted" style={styles.flex}>
                          {t(RECORD_LABEL[record.kind])}
                        </Txt>
                        <Txt variant="headline" weight="700">
                          {formatRecordValue(record.kind, record.value, units)}
                        </Txt>
                      </Row>
                    ))}
                  </Column>
                </Card>
              </Column>
            ) : null}

            {variations.data !== undefined && variations.data.length > 0 ? (
              <>
                <Column gap="md" style={styles.section}>
                  <SectionHeader
                    title={t('exerciseDetail.variations')}
                    counter={variations.data.length}
                    eyebrow={t('exerciseDetail.sameFamily')}
                  />
                </Column>
                <View>
                  {variations.data.map((sibling, i) => (
                    <ExerciseRow
                      key={sibling.id}
                      name={sibling.name}
                      uri={sibling.thumbnailUrl ?? sibling.imageUrl}
                      tags={[
                        {
                          key: 'kind',
                          label:
                            sibling.id === exercise.id
                              ? t('exerciseDetail.thisExercise')
                              : (sibling.category ?? t('exerciseDetail.variation')),
                        },
                      ]}
                      theme={theme}
                      dimmed={sibling.id === exercise.id}
                      topDivider={i > 0}
                      onPress={() => {
                        if (sibling.id === exercise.id) return;
                        router.push(routes.exerciseDetail(sibling.id));
                      }}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {externalUrl !== null ? (
              <Column style={styles.section}>
                <ActionRow
                  title={t('exerciseDetail.viewOnWger')}
                  subtitle={t('exerciseDetail.wgerSubtitle')}
                  icon="link"
                  onPress={() => {
                    void Linking.openURL(externalUrl).catch(() => undefined);
                  }}
                />
              </Column>
            ) : null}
          </Column>
        )}
      </ScrollView>
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function Hero({ exercise, topInset }: { exercise: Exercise; topInset: number }) {
  const { t } = useT();
  const theme = useAppTheme();
  const uri = exercise.imageUrl ?? exercise.thumbnailUrl;

  if (uri === null) {
    // Designed absence, not a missing image: the initials plaque the rest of the app
    // uses for an artless exercise, blown up to fill the same slot a picture would. The
    // layout keeps its shape between the two states, so an exercise with no art reads as
    // "the library has none for this one", never as "the picture failed to load".
    return (
      <LinearGradient
        colors={[theme.colors.surfaceRaised, theme.colors.canvas]}
        // The bar floats over this slot too, so the plaque is pushed clear of it even
        // though there is no picture to protect.
        style={[styles.noArt, { height: topInset + NO_ART_HEIGHT, paddingTop: topInset }]}
      >
        <Txt variant="micro" tone="faint" uppercase tracking={1}>
          {exercise.category ?? t('exerciseDetail.fallbackTitle')}
        </Txt>
        <Gap size={spacing.lg} />
        <ExerciseThumb
          uri={null}
          name={exercise.name}
          size={96}
          theme={theme}
          rounded={radius.xl}
        />
        <Gap size={spacing.lg} />
        <Row gap="xs" align="center">
          <Icon name="image" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
          <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
            {t('exerciseDetail.noImage')}
          </Txt>
        </Row>
      </LinearGradient>
    );
  }

  return (
    <View style={{ height: topInset + ART_HEIGHT, paddingTop: topInset }}>
      <Image
        source={{ uri }}
        style={styles.flex}
        contentFit="contain"
        transition={220}
        recyclingKey={uri}
        accessibilityLabel={t('exerciseDetail.illustrationFor', { name: exercise.name })}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function Provenance({
  from,
  storedAt,
  isFetching,
  onRetry,
  externalUrl,
}: {
  from: 'stored' | 'cache' | 'remote' | 'none';
  storedAt: number | null;
  isFetching: boolean;
  onRetry: () => void;
  externalUrl: string | null;
}) {
  const { t } = useT();
  const theme = useAppTheme();

  if (from === 'stored') {
    return (
      <Row gap="sm" align="center">
        <Icon name="offline" size={ICON_SIZE.micro} color={theme.colors.info} />
        <Txt variant="caption" tone="muted" style={styles.flex}>
          {storedAt === null
            ? t('exerciseDetail.offlineCopy')
            : t('exerciseDetail.offlineCopyDated', { date: shortDateLabel(storedAt) })}
        </Txt>
        {/* A Text with role="button" rather than a nested Touchable: it sits in a line of
            text-width content, and VoiceOver reads the label as its own element either
            way: this way there is one less layout wrapper. */}
        <Txt
          variant="caption"
          weight="700"
          color={theme.colors.accent}
          role="button"
          onPress={onRetry}
          suppressHighlighting
        >
          {t(isFetching ? 'exerciseDetail.checking' : 'exerciseDetail.checkUpdates')}
        </Txt>
      </Row>
    );
  }

  if (from === 'cache') {
    return (
      <Row gap="sm" align="center">
        <Icon name="layers" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
        <Txt variant="caption" tone="muted">{t('exerciseDetail.fromRecentSearch')}</Txt>
      </Row>
    );
  }

  if (from === 'remote') {
    return (
      <Row gap="sm" align="center">
        <Icon name="download" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
        <Txt variant="caption" tone="muted">
          {t('exerciseDetail.liveFromWger')}
          {externalUrl !== null ? t('exerciseDetail.justNow') : ''}
        </Txt>
      </Row>
    );
  }

  return (
    <Row gap="sm" align="center">
      <Icon name="info" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
      <Txt variant="caption" tone="muted">{t('exerciseDetail.builtIn')}</Txt>
    </Row>
  );
}

/** One labelled row of taxonomy: "Primary" above its muscles. Nothing at all when empty. */
function TagGroup({ label, tags, theme }: { label: string; tags: readonly Tag[]; theme: Theme }) {
  if (tags.length === 0) return null;
  return (
    <Column gap="xs">
      <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
        {label}
      </Txt>
      <TagRow tags={tags} theme={theme} />
    </Column>
  );
}

/**
 * One past session with this exercise: the top set as the title, the date and the sets done
 * as items, and the estimated max (or how long ago) at the end.
 */
const HistoryRow = memo(function HistoryRow({
  session,
  units,
  theme,
  topDivider,
  onOpen,
}: {
  session: ExercisePerformance;
  units: UnitSystem;
  theme: Theme;
  topDivider: boolean;
  onOpen: (activityId: string) => void;
}) {
  const { t } = useT();
  const load =
    session.topWeightKg > 0
      ? `${formatWeight(session.topWeightKg, units)} × ${session.topReps}`
      : t('exerciseDetail.bodyweightTimes', { reps: session.topReps });
  const meta = useMemo(
    () => [
      { icon: 'calendar' as const, label: shortDateLabel(session.performedAt) },
      {
        icon: 'layers' as const,
        label:
          session.completedSets === session.sets
            ? t('workout.set', { count: session.completedSets })
            : t('details.setsOfTotal', { done: session.completedSets, total: session.sets }),
      },
    ],
    [session.completedSets, session.performedAt, session.sets, t],
  );
  const press = useCallback(() => onOpen(session.activityId), [onOpen, session.activityId]);

  return (
    <View
      style={
        topDivider
          ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline }
          : undefined
      }
    >
      <ListRow
        theme={theme}
        title={load}
        meta={meta}
        showChevron
        onPress={press}
        accessibilityHint={t('exerciseDetail.openSession')}
        trailing={
          session.estimated1rmKg === null ? (
            <Txt variant="caption" tone="faint">
              {agoLabel(session.performedAt)}
            </Txt>
          ) : (
            <Badge
              label={t('exerciseDetail.estSuffix', {
                value: formatWeight(session.estimated1rmKg, units),
              })}
              tone="success"
              icon={<Icon name="trophy" size={ICON_SIZE.micro} color={theme.colors.success} />}
            />
          )
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  section: { paddingHorizontal: screenGutter },
  chartTitle: { marginBottom: spacing.lg },
  noArt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: screenGutter,
  },
  stats: { flexDirection: 'row', gap: spacing.lg },
  flex: { flex: 1 },
  // Row lists get no wrapper padding of their own: `ListRow` and `ExerciseRow` carry
  // their own `screenGutter` inset and a full-bleed hairline, so a second inset would
  // make their dividers stop short of the edge the rest of the app's dividers reach.
  bandFooter: { paddingHorizontal: screenGutter, paddingVertical: spacing.md },
});
