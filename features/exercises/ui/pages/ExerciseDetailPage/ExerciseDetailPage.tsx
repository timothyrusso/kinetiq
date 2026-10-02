import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Card,
  Stack as Column,
  EmptyState,
  ErrorState,
  ICON_SIZE,
  Icon,
  NumberedSteps,
  Row,
  SCROLL_INSETS,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  TagRow,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { HeaderToolbar, headerAction } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ExerciseHero } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero';
import { ExerciseProvenance } from '@/features/exercises/ui/components/ExerciseProvenance/ExerciseProvenance';
import { SimilarExerciseRow } from '@/features/exercises/ui/components/SimilarExerciseRow/SimilarExerciseRow';
import { TaxonomyTagGroup } from '@/features/exercises/ui/components/TaxonomyTagGroup/TaxonomyTagGroup';
import { useExerciseDetailPageLogic } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.logic';
import { createStyles } from '@/features/exercises/ui/pages/ExerciseDetailPage/ExerciseDetailPage.style';

/** Fade, matching the activity detail: a slide would drag the previous list's thumbnails across the art. */
const SCREEN_OPTIONS = { animation: 'fade_from_bottom' } as const;

/**
 * Exercise detail: what the library says about one movement, and what the user has done with it.
 *
 * Under the hero sit the badges (training type when it is not strength, level, mechanic) and, for
 * a stored copy, one line saying so, which explains a missing photo before the user goes looking
 * for one. Nothing is inferred to fill a gap: a missing description is a named
 * silence, missing art a designed composition. Muscle and equipment chips are labels and go
 * nowhere: the library is reached only to pick an exercise.
 *
 * What the user has done with the exercise belongs to the workouts, a feature above this one, so
 * the route hands that section in as `renderHistory`, drawn between the how-to and the similar
 * exercises.
 */
export function ExerciseDetailPage({ renderHistory }: { renderHistory?: (exerciseId: string | null) => ReactNode }) {
  const { state, derived, effects } = useExerciseDetailPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { exercise } = state;

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScreenHeader title={derived.title} transparent={derived.transparent} />
      {derived.closable ? (
        <HeaderToolbar placement="right">
          {headerAction({
            action: 'save',
            label: 'headerActions.done',
            onPress: effects.close,
            t,
            variant: 'done',
            tint: theme.colors.accent,
          })}
        </HeaderToolbar>
      ) : null}
      <ScrollView {...SCROLL_INSETS} contentContainerStyle={derived.contentStyle}>
        {state.isLoading ? (
          <Column gap="lg" style={[styles.section, styles.status]}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={5} />
          </Column>
        ) : exercise === null ? (
          <View style={styles.status}>
            {state.error !== null ? (
              <ErrorState error={state.error} onRetry={effects.retry} title={t('exerciseDetail.loadError')} />
            ) : (
              <EmptyState
                icon="info"
                title={t('exerciseDetail.unknownTitle')}
                message={t(state.isCatalogId ? 'exerciseDetail.unknownFetchable' : 'exerciseDetail.unknownBuiltIn')}
                actionLabel={t(state.isCatalogId ? 'common.retry' : 'exerciseDetail.backToLibrary')}
                onAction={state.isCatalogId ? effects.retry : effects.goBack}
              />
            )}
          </View>
        ) : (
          <Column gap="xxl">
            <ExerciseHero exercise={exercise} />

            {derived.hasLead ? (
              <Column gap="md" style={styles.section}>
                <TagRow tags={derived.badgeTags} theme={theme} />
                <ExerciseProvenance from={state.from} storedAt={state.storedAt} />
              </Column>
            ) : null}

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
              {derived.steps === null ? (
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
                  <NumberedSteps steps={derived.steps} variant="bodyLg" />
                </Card>
              )}
            </Column>

            {renderHistory?.(state.exerciseId)}

            {state.similar.length > 0 ? (
              <>
                <Column gap="md" style={styles.section}>
                  <SectionHeader
                    title={t('exerciseDetail.similar')}
                    counter={state.similar.length}
                    eyebrow={t('exerciseDetail.similarEyebrow')}
                  />
                </Column>
                <View>
                  {state.similar.map((sibling, index) => (
                    <SimilarExerciseRow
                      key={sibling.id}
                      exercise={sibling}
                      theme={theme}
                      topDivider={index > 0}
                      onOpen={effects.openSimilar}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </Column>
        )}
      </ScrollView>
    </>
  );
}
