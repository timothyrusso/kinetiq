import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import {
  EXERCISE_IMAGE_CACHE,
  ExerciseThumb,
  Gap,
  ICON_SIZE,
  Icon,
  Row,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { radius, spacing, useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExerciseHeroLogic } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero.logic';
import { createStyles } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero.style';

/**
 * The art is the header, not a section: a full-width photo under a transparent bar, starting
 * where the bar ends and fitted whole, never cropped. With no art, the slot keeps roughly the same
 * proportions and holds a composition instead: the initials plaque the rest of the app uses,
 * blown up, with a caption that says which absence it is (no photo bundled for this exercise, or a
 * bundled one that failed to load).
 */
export function ExerciseHero({ exercise, topInset }: { exercise: Exercise; topInset: number }) {
  const { state, derived, effects } = useExerciseHeroLogic(exercise, topInset);
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  if (state.source === null) {
    return (
      <LinearGradient
        colors={[theme.colors.surfaceRaised, theme.colors.canvas]}
        style={[styles.noArt, derived.noArtStyle]}
      >
        <Txt variant="micro" tone="faint" uppercase tracking={1}>
          {exercise.category ?? t('exerciseDetail.fallbackTitle')}
        </Txt>
        <Gap size={spacing.lg} />
        <ExerciseThumb source={null} name={exercise.name} size={96} theme={theme} rounded={radius.xl} />
        <Gap size={spacing.lg} />
        <Row gap="xs" align="center">
          <Icon name="image" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
          <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
            {t(state.hasArt ? 'exerciseDetail.imageUnavailable' : 'exerciseDetail.noImage')}
          </Txt>
        </Row>
      </LinearGradient>
    );
  }

  return (
    <View style={derived.artStyle}>
      <Image
        source={state.source}
        style={styles.image}
        contentFit="contain"
        transition={220}
        recyclingKey={String(state.source)}
        cachePolicy={EXERCISE_IMAGE_CACHE}
        onError={effects.markFailed}
        accessibilityLabel={t('exerciseDetail.illustrationFor', { name: exercise.name })}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
