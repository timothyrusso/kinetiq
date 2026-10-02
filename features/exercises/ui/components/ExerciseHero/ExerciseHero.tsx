import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
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
 * The art is the header, not a section: a full-width 3:2 photo under a transparent bar, starting
 * where the bar ends. The start and end frames are stacked and the end one fades in and out over
 * it, so the photo reads as the movement; the pair is one image to a screen reader, named once.
 * With no art, the slot keeps roughly the same proportions and holds a composition instead: the
 * initials plaque the rest of the app uses, blown up, with a caption that says which absence it is
 * (no photo bundled yet, none ever for a custom exercise, or a bundled one that failed to load).
 */
export function ExerciseHero({ exercise, topInset }: { exercise: Exercise; topInset: number }) {
  const { state, derived, effects } = useExerciseHeroLogic(exercise, topInset);
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  if (state.start === null) {
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
            {t(state.caption)}
          </Txt>
        </Row>
      </LinearGradient>
    );
  }

  return (
    <View style={derived.artStyle}>
      <View
        style={styles.frame}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('exerciseDetail.photoOf', { name: exercise.name })}
      >
        <Image
          source={state.start}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          recyclingKey={String(state.start)}
          cachePolicy={EXERCISE_IMAGE_CACHE}
          onError={effects.markFailed}
          accessibilityIgnoresInvertColors
        />
        {state.end !== null ? (
          <Animated.View style={[StyleSheet.absoluteFill, derived.fade]} pointerEvents="none">
            <Image
              source={state.end}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              recyclingKey={String(state.end)}
              cachePolicy={EXERCISE_IMAGE_CACHE}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
