import { Image } from 'expo-image';
import { View } from 'react-native';
import { EXERCISE_IMAGE_CACHE, NumberedSteps, Txt, useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useExerciseAboutLogic } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout.logic';
import { createStyles } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout.style';

/** The exercise's picture and description, under the targets so adjusting never scrolls past them. */
export function ExerciseAbout({ exerciseId }: { exerciseId: string }) {
  const { state, derived } = useExerciseAboutLogic(exerciseId);
  const { t } = useT();
  const styles = useStyles(createStyles);

  if (state.isLoading) {
    return (
      <Txt variant="caption" tone="faint">
        {t('itemEditor.loadingDetails')}
      </Txt>
    );
  }
  return (
    <View style={styles.about}>
      {derived.image !== null ? (
        <Image
          source={derived.image}
          recyclingKey={String(derived.image)}
          cachePolicy={EXERCISE_IMAGE_CACHE}
          contentFit="cover"
          style={styles.image}
          accessibilityLabel={derived.imageLabel}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {derived.steps === null ? (
        <Txt variant="caption" tone="faint">
          {derived.fallback}
        </Txt>
      ) : (
        <NumberedSteps steps={derived.steps} variant="caption" tone="muted" />
      )}
    </View>
  );
}
