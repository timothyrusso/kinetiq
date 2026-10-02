import { Pressable, View } from 'react-native';
import { CrossFadeImage, ICON_SIZE, Icon, NumberedSteps, Row, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { useExerciseAboutLogic } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout.logic';
import { createStyles } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout.style';

/**
 * The exercise's picture and description, under the targets so adjusting never scrolls past them.
 * The title and the photo are one link to the exercise page; the steps are not, so reading them
 * with a thumb on the screen does not navigate away.
 */
export function ExerciseAbout({ exerciseId }: { exerciseId: string }) {
  const { state, derived, effects } = useExerciseAboutLogic(exerciseId);
  const { t } = useT();
  const theme = useAppTheme();
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
      <Pressable
        onPress={effects.open}
        accessibilityRole="button"
        accessibilityLabel={derived.openLabel}
        accessibilityHint={t('exerciseDetail.openHint')}
        style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
      >
        <Row align="center" justify="between" style={styles.title}>
          <Txt variant="label" tone="accent">
            {t('exerciseDetail.open')}
          </Txt>
          <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
        </Row>
        {derived.image !== null ? (
          <CrossFadeImage
            start={derived.image}
            end={derived.imageEnd}
            active={state.animating}
            label={derived.imageLabel}
            style={styles.image}
          />
        ) : null}
      </Pressable>
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
