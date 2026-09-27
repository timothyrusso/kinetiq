import { ICON_SIZE, Icon, Row, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { shortDateLabel } from '@/features/core/utils';
import type { ExerciseSourceKind } from '@/features/exercises/domain/entities/ExerciseSourceKind';
import { createStyles } from '@/features/exercises/ui/components/ExerciseProvenance/ExerciseProvenance.style';

/**
 * One line under the hero saying where the exercise on screen came from. A stored copy is dated,
 * which explains why there is no video, and gets a "check for updates" action when the catalog
 * could have the exercise. The action is a Text with role="button" rather than a nested
 * Touchable: it sits in a line of text-width content, and VoiceOver reads it as its own element.
 */
export function ExerciseProvenance({
  from,
  storedAt,
  isFetching,
  onRetry,
}: {
  from: ExerciseSourceKind;
  storedAt: number | null;
  isFetching: boolean;
  /** Null when the catalog cannot have this exercise (a `local:` id): nothing to check. */
  onRetry: (() => void) | null;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  if (from === 'stored') {
    return (
      <Row gap="sm" align="center">
        <Icon name="offline" size={ICON_SIZE.micro} color={theme.colors.info} />
        <Txt variant="caption" tone="muted" style={styles.flex}>
          {storedAt === null
            ? t('exerciseDetail.offlineCopy')
            : t('exerciseDetail.offlineCopyDated', { date: shortDateLabel(storedAt) })}
        </Txt>
        {onRetry !== null ? (
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
        ) : null}
      </Row>
    );
  }

  if (from === 'catalog') {
    return (
      <Row gap="sm" align="center">
        <Icon name="layers" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
        <Txt variant="caption" tone="muted">
          {t('exerciseDetail.fromLibrary')}
        </Txt>
      </Row>
    );
  }

  return (
    <Row gap="sm" align="center">
      <Icon name="info" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
      <Txt variant="caption" tone="muted">
        {t('exerciseDetail.builtIn')}
      </Txt>
    </Row>
  );
}
