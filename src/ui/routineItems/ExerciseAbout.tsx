import { StyleSheet, View } from 'react-native';

import { Txt } from '@/ui/Text';
import { Image } from 'expo-image';
import { EXERCISE_IMAGE_CACHE } from '@/ui/imageCache';
import { useExerciseResolution } from '@/queries/useExercises';
import { palette, spacing } from '@/theme/tokens';
import { useT } from '@/i18n/useT';

/**
 * What the library says about the exercise: its picture and its description, under the
 * targets so adjusting sets and reps never has to scroll past them.
 *
 * Read through `useExerciseResolution`, not the snapshot alone: a snapshot captured from a
 * search row often has no description and only a thumbnail, and the resolution fills both in
 * from wger (or from the stored copy offline). A missing description is said, not hidden.
 */
export function ExerciseAbout({ exerciseId }: { exerciseId: string }) {
  const { t } = useT();
  const detail = useExerciseResolution(exerciseId);
  const exercise = detail.exercise;
  const image = exercise?.imageUrl ?? exercise?.thumbnailUrl ?? null;
  const instructions = exercise?.instructions?.trim() || null;

  if (detail.isLoading) {
    return (
      <Txt variant="caption" tone="faint">
        {t('itemEditor.loadingDetails')}
      </Txt>
    );
  }
  return (
    <View style={aboutStyles.about}>
      {image !== null ? (
        <View style={[aboutStyles.art, { backgroundColor: palette.white }]}>
          <Image
            source={{ uri: image }}
            recyclingKey={image}
            cachePolicy={EXERCISE_IMAGE_CACHE}
            contentFit="contain"
            style={aboutStyles.image}
            accessibilityLabel={t('itemEditor.imageA11y', { name: exercise?.name ?? '' })}
          />
        </View>
      ) : null}
      <Txt variant="caption" tone={instructions ? 'muted' : 'faint'}>
        {instructions ??
          t(detail.fetchable ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn')}
      </Txt>
    </View>
  );
}

const aboutStyles = StyleSheet.create({
  about: { gap: spacing.md },
  // Technical drawings on a white card in both themes: most wger art is black line work on a
  // transparent background, which vanishes on the dark canvas.
  art: { borderRadius: spacing.md, overflow: 'hidden', padding: spacing.sm },
  image: { width: '100%', aspectRatio: 4 / 3 },
});
