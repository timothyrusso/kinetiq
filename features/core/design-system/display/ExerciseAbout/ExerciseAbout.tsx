import { memo } from 'react';
import { Pressable, View } from 'react-native';
import type { BundledImage } from '@/features/core/design-system/display/BundledPhoto';
import { CrossFadeImage } from '@/features/core/design-system/display/CrossFadeImage';
import { createStyles } from '@/features/core/design-system/display/ExerciseAbout/ExerciseAbout.style';
import { NumberedSteps } from '@/features/core/design-system/display/NumberedSteps';
import { ICON_SIZE, Icon } from '@/features/core/design-system/icons/icons';
import { Row } from '@/features/core/design-system/layout/Row';
import { useStyles } from '@/features/core/design-system/styles/useStyles';
import { Txt } from '@/features/core/design-system/text/Text';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

/** What an exercise editor's About block draws: the library's picture, steps and a link. */
export interface ExerciseAboutContent {
  readonly isLoading: boolean;
  readonly image: BundledImage | null;
  /** The end frame the photo cross-fades to, or `null` for a still. */
  readonly imageEnd: BundledImage | null;
  /** The photo moves only while its screen is the focused one. */
  readonly animating: boolean;
  readonly imageLabel: string;
  readonly openLabel: string;
  /** The trimmed steps, or `null` when there are none and `fallback` says so. */
  readonly steps: readonly string[] | null;
  readonly fallback: string;
  readonly onOpen: () => void;
}

/**
 * The exercise's picture and description, under the targets so adjusting never scrolls past them.
 * The title and the photo are one link to the exercise page; the steps are not, so reading them
 * with a thumb on the screen does not navigate away. Both exercise editors draw it from what the
 * exercises' `useExerciseAbout` reads.
 */
export const ExerciseAbout = memo(function ExerciseAbout({ about }: { about: ExerciseAboutContent }) {
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  if (about.isLoading) {
    return (
      <Txt variant="caption" tone="faint">
        {t('itemEditor.loadingDetails')}
      </Txt>
    );
  }
  return (
    <View style={styles.about}>
      <Pressable
        onPress={about.onOpen}
        accessibilityRole="button"
        accessibilityLabel={about.openLabel}
        accessibilityHint={t('exerciseDetail.openHint')}
        style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
      >
        <Row align="center" justify="between" style={styles.title}>
          <Txt variant="label" tone="accent">
            {t('exerciseDetail.open')}
          </Txt>
          <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
        </Row>
        {about.image !== null ? (
          <CrossFadeImage
            start={about.image}
            end={about.imageEnd}
            active={about.animating}
            label={about.imageLabel}
            style={styles.image}
          />
        ) : null}
      </Pressable>
      {about.steps === null ? (
        <Txt variant="caption" tone="faint">
          {about.fallback}
        </Txt>
      ) : (
        <NumberedSteps steps={about.steps} variant="caption" tone="muted" />
      )}
    </View>
  );
});
