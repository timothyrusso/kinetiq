import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import {
  ActionRow,
  Card,
  Stack as Column,
  EmptyState,
  ErrorState,
  ICON_SIZE,
  Icon,
  Row,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  TagRow,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ExerciseHero } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero';
import { ExerciseHistorySection } from '@/features/exercises/ui/components/ExerciseHistorySection/ExerciseHistorySection';
import { ExerciseProvenance } from '@/features/exercises/ui/components/ExerciseProvenance/ExerciseProvenance';
import { ExerciseVariationRow } from '@/features/exercises/ui/components/ExerciseVariationRow/ExerciseVariationRow';
import { TaxonomyTagGroup } from '@/features/exercises/ui/components/TaxonomyTagGroup/TaxonomyTagGroup';
import { useExerciseDetailPageLogic } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.logic';
import { createStyles } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.style';

/** Fade, matching the activity detail: a slide would drag the previous list's thumbnails across the art. */
const SCREEN_OPTIONS = { animation: 'fade_from_bottom' } as const;

/**
 * Exercise detail: what the library says about one movement, and what the user has done with it.
 *
 * The screen is a provenance report as much as a description: one line under the hero says
 * whether this is the library's row or a stored copy, which explains a missing video before the
 * user goes looking for one. Nothing is inferred to fill a gap: a missing description is a named
 * silence, missing art a designed composition. Muscle and equipment chips are labels and go
 * nowhere: the library is reached only to pick an exercise.
 */
export function ExerciseDetailPage() {
  const { state, derived, effects } = useExerciseDetailPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { exercise } = state;

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScreenHeader title={derived.title} transparent={derived.transparent} />
      <ScrollView contentContainerStyle={derived.contentStyle}>
        {state.isLoading ? (
          <Column gap="lg" style={[styles.section, derived.statusStyle]}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={5} />
          </Column>
        ) : exercise === null ? (
          <View style={derived.statusStyle}>
            {state.error !== null ? (
              <ErrorState error={state.error} onRetry={effects.retry} title={t('exerciseDetail.loadError')} />
            ) : (
              <EmptyState
                icon="info"
                title={t('exerciseDetail.unknownTitle')}
                message={t(state.fetchable ? 'exerciseDetail.unknownFetchable' : 'exerciseDetail.unknownBuiltIn')}
                actionLabel={t(state.fetchable ? 'common.retry' : 'exerciseDetail.backToLibrary')}
                onAction={state.fetchable ? effects.retry : effects.goBack}
              />
            )}
          </View>
        ) : (
          <Column gap="xxl">
            <ExerciseHero exercise={exercise} topInset={derived.topInset} />

            <Column gap="md" style={styles.section}>
              <ExerciseProvenance
                from={state.from}
                storedAt={state.storedAt}
                isFetching={state.isFetching}
                onRetry={state.fetchable ? effects.retry : null}
              />
            </Column>

            {derived.primaryTags.length + derived.secondaryTags.length > 0 ? (
              <Column gap="md" style={styles.section}>
                <SectionHeader title={t('exerciseDetail.muscles')} />
                <TaxonomyTagGroup label={t('exerciseDetail.primary')} tags={derived.primaryTags} theme={theme} />
                <TaxonomyTagGroup label={t('exerciseDetail.alsoWorked')} tags={derived.secondaryTags} theme={theme} />
              </Column>
            ) : null}

            {derived.equipmentTags.length > 0 ? (
              <Column gap="md" style={styles.section}>
                <SectionHeader title={t('exerciseDetail.equipment')} />
                <TagRow tags={derived.equipmentTags} theme={theme} />
              </Column>
            ) : null}

            <Column gap="md" style={styles.section}>
              <SectionHeader title={t('exerciseDetail.howTo')} />
              {derived.instructions === null ? (
                <Card tone="sunken">
                  <Row gap="md" align="start">
                    <Icon name="info" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
                    <Txt variant="body" tone="muted" style={styles.flex}>
                      {t(
                        state.from === 'stored'
                          ? 'exerciseDetail.noDescriptionOffline'
                          : 'exerciseDetail.noDescription',
                      )}
                    </Txt>
                  </Row>
                </Card>
              ) : (
                <Card>
                  <Txt variant="bodyLg">{derived.instructions}</Txt>
                </Card>
              )}
            </Column>

            <ExerciseHistorySection exerciseId={state.exerciseId} />

            {state.variations.length > 0 ? (
              <>
                <Column gap="md" style={styles.section}>
                  <SectionHeader
                    title={t('exerciseDetail.variations')}
                    counter={state.variations.length}
                    eyebrow={t('exerciseDetail.sameFamily')}
                  />
                </Column>
                <View>
                  {state.variations.map((sibling, index) => (
                    <ExerciseVariationRow
                      key={sibling.id}
                      exercise={sibling}
                      current={sibling.id === exercise.id}
                      theme={theme}
                      topDivider={index > 0}
                      onOpen={effects.openVariation}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {derived.hasExternalPage ? (
              <Column style={styles.section}>
                <ActionRow
                  title={t('exerciseDetail.viewOnWger')}
                  subtitle={t('exerciseDetail.wgerSubtitle')}
                  icon="link"
                  onPress={effects.openExternal}
                />
              </Column>
            ) : null}
          </Column>
        )}
      </ScrollView>
    </>
  );
}
