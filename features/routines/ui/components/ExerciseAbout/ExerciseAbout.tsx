import { Image } from 'expo-image';
import { View } from 'react-native';
import { EXERCISE_IMAGE_CACHE, Txt, useStyles } from '@/features/core/design-system';
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
        <View style={styles.art}>
          <Image
            source={{ uri: derived.image }}
            recyclingKey={derived.image}
            cachePolicy={EXERCISE_IMAGE_CACHE}
            contentFit="contain"
            style={styles.image}
            accessibilityLabel={derived.imageLabel}
          />
        </View>
      ) : null}
      <Txt variant="caption" tone={derived.described ? 'muted' : 'faint'}>
        {derived.description}
      </Txt>
    </View>
  );
}
